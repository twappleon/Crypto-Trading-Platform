'use strict';
// R020 real PostgreSQL 16 CI BDD for durable synthetic reservation / cancel.
// Intentionally NOT exposed as a public trading API. No custody, live orders, funding, KYC.
const assert=require('node:assert/strict');
const {Client}=require('../web/node_modules/pg');
const {reservePaperHold,cancelPaperHold}=require('../web/paper-reservations.cjs');
const {createHandler}=require('../web/api/paper-balances.js');
const crypto=require('node:crypto');
const url=process.env.PAPER_DATABASE_URL,secret=process.env.PAPER_SESSION_SECRET;
assert.ok(url&&secret&&secret.length>=32);
const first=new Client({connectionString:url}),second=new Client({connectionString:url});
async function available(client,owner,asset){
 const q=await client.query(`SELECT a.balance::text AS total,COALESCE(SUM(h.amount) FILTER (WHERE h.state='ACTIVE'),0)::text AS locked
 FROM paper_ledger_accounts a LEFT JOIN paper_ledger_holds h ON h.account_id=a.account_id AND h.asset=a.asset
 WHERE a.account_id=$1 AND a.asset=$2 GROUP BY a.balance`,[owner,asset]);
 assert.equal(q.rowCount,1);
 return Number(q.rows[0].total)-Number(q.rows[0].locked);
}
(async()=>{
 await first.connect();await second.connect();
 try{
  // Previous QA in this job created the isolated paper schema. No production database.
  await first.query(`INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES
   ('USDC','r20_alice',100),('BTC','r20_alice',2),('USDC','r20_bob',100),('BTC','r20_bob',2)`);
  const a=await reservePaperHold(first,{id:'r20_order_1',owner:'r20_alice',asset:'USDC',amount:'30.00'});
  assert.equal(a.state,'ACTIVE');assert.equal(a.replayed,false);
  assert.equal(await available(first,'r20_alice','USDC'),70);
  const repeat=await reservePaperHold(first,{id:'r20_order_1',owner:'r20_alice',asset:'USDC',amount:'30'});
  assert.equal(repeat.replayed,true);
  assert.equal(await available(first,'r20_alice','USDC'),70,'idempotency must not double-lock');
  await assert.rejects(()=>reservePaperHold(first,{id:'r20_order_1',owner:'r20_alice',asset:'USDC',amount:'31'}),{code:'PAPER_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(()=>reservePaperHold(first,{id:'r20_order_1',owner:'r20_bob',asset:'USDC',amount:'30'}),{code:'PAPER_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(()=>reservePaperHold(first,{id:'r20_over',owner:'r20_alice',asset:'USDC',amount:'70.01'}),{code:'PAPER_INSUFFICIENT_FUNDS'});
  assert.equal(await available(first,'r20_alice','USDC'),70);
  await assert.rejects(()=>cancelPaperHold(first,{id:'r20_order_1',owner:'r20_bob'}),{code:'PAPER_HOLD_NOT_FOUND'});
  assert.equal(await available(first,'r20_alice','USDC'),70,'different user cannot release hold');
  // Distinct client connections race for the same available funds: one must reject.
  const race=await Promise.allSettled([
    reservePaperHold(first,{id:'r20_race_a',owner:'r20_alice',asset:'USDC',amount:'50'}),
    reservePaperHold(second,{id:'r20_race_b',owner:'r20_alice',asset:'USDC',amount:'50'})
  ]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1,'row lock prevents double reservation');
  assert.equal(race.filter(x=>x.status==='rejected').length,1);
  assert.equal(race.find(x=>x.status==='rejected').reason.code,'PAPER_INSUFFICIENT_FUNDS');
  assert.equal(await available(first,'r20_alice','USDC'),20);
  assert.equal(await available(first,'r20_bob','USDC'),100,'other account unchanged');
  assert.equal((await cancelPaperHold(first,{id:'r20_order_1',owner:'r20_alice'})).replayed,false);
  assert.equal((await cancelPaperHold(first,{id:'r20_order_1',owner:'r20_alice'})).replayed,true);
  assert.equal(await available(first,'r20_alice','USDC'),50,'cancel releases precisely once');
  const afterCancel=await reservePaperHold(first,{id:'r20_order_1',owner:'r20_alice',asset:'USDC',amount:'30.00'});
  assert.equal(afterCancel.state,'RELEASED','replay cannot resurrect canceled hold');
  assert.equal(await available(first,'r20_alice','USDC'),50);
  // R021: old code would return ACTIVE without waiting for an in-flight
  // cancellation. Real PostgreSQL account row locking must serialize replays.
  await reservePaperHold(first,{id:'r21_replay_race',owner:'r20_alice',asset:'USDC',amount:'5.00'});
  await second.query('BEGIN');
  try{
   await second.query('SELECT balance FROM paper_ledger_accounts WHERE account_id=$1 AND asset=$2 FOR UPDATE',
    ['r20_alice','USDC']);
   await second.query("UPDATE paper_ledger_holds SET state='RELEASED' WHERE id='r21_replay_race' AND account_id='r20_alice'");
   const replayPromise=reservePaperHold(first,{id:'r21_replay_race',owner:'r20_alice',asset:'USDC',amount:'5.00'});
   const duringCancel=await Promise.race([replayPromise.then(()=> 'resolved',()=> 'rejected'),
    new Promise(resolve=>setTimeout(()=>resolve('blocked'),100))]);
   assert.equal(duringCancel,'blocked','replay must wait for pending cancellation row lock');
   await second.query('COMMIT');
   const raceReplay=await replayPromise;
   assert.equal(raceReplay.replayed,true);
   assert.equal(raceReplay.state,'RELEASED','durable post-lock state must win after cancellation');
   assert.equal(await available(first,'r20_alice','USDC'),50,'no re-reserve after committed cancellation');
  }catch(error){await second.query('ROLLBACK').catch(()=>{});throw error}
  await reservePaperHold(second,{id:'r20_btc_1',owner:'r20_bob',asset:'BTC',amount:'0.000001'});
  assert.equal(await available(first,'r20_bob','BTC'),1.999999);
  // Simulate database crash/rollback of an uncommitted hold, not a claimed recovery algorithm.
  await first.query('BEGIN');
  await first.query("INSERT INTO paper_ledger_holds(id,account_id,asset,amount,state) VALUES ('r20_uncommitted','r20_bob','USDC',1,'ACTIVE')");
  await first.query('ROLLBACK');
  assert.equal((await second.query("SELECT 1 FROM paper_ledger_holds WHERE id='r20_uncommitted'")).rowCount,0);
  const claim=Buffer.from(JSON.stringify({sub:'r20_alice',scope:'paper:balances:read',exp:Math.floor(Date.now()/1000)+120})).toString('base64url');
  const hmac=crypto.createHmac('sha256',secret).update('v1.'+claim).digest('base64url');
  let status,result;
  await createHandler()({method:'GET',headers:{authorization:'Bearer v1.'+claim+'.'+hmac}},
    {statusCode:200,setHeader(){},end(body){status=this.statusCode;result=JSON.parse(body)}});
  assert.equal(status,200,'existing read API sees committed reservation state from another connection');
  const usdc=result.balances.find(row=>row.asset==='USDC');
  assert.equal(Number(usdc.locked),50);
  assert.equal(Number(usdc.available),50);
  console.log('PASS R020: REAL PostgreSQL durable reserves, row-locked concurrent overdraft, idem/cancel/owner isolation/rollback/read integration');
 }finally{await first.end();await second.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
