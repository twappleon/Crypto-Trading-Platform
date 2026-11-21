'use strict';
// R025: actual isolated PostgreSQL 16 release endpoint, replay, atomic locking, isolation.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('../web/node_modules/pg');
const {reservePaperHold}=require('../web/paper-reservations.cjs');
const {createHandler}=require('../web/api/paper-release.js');
const url=process.env.PAPER_DATABASE_URL,secret=process.env.PAPER_SESSION_SECRET;
assert.ok(url&&secret&&secret.length>=32);
const env={PAPER_DATABASE_URL:url,PAPER_SESSION_SECRET:secret,PAPER_RESERVATIONS_WRITE_ENABLED:'sandbox-only'};
function token(sub){
 const claim=Buffer.from(JSON.stringify({sub,scope:'paper:reservations:write',
  exp:Math.floor(Date.now()/1000)+120})).toString('base64url');
 return 'Bearer v1.'+claim+'.'+crypto.createHmac('sha256',secret).update('v1.'+claim).digest('base64url');
}
async function invoke(handler,owner,body={id:'r25_hold'},headers={}){
 const res={statusCode:200,setHeader(){},end(raw){this.calls=(this.calls||0)+1;this.raw=raw}};
 await handler({method:'POST',headers:{authorization:owner?token(owner):undefined,
  'content-type':'application/json',...headers},body,url:'/api/paper-release?owner=paper_bob_r25'},res);
 assert.equal(res.calls,1);
 return {status:res.statusCode,body:JSON.parse(res.raw)};
}
async function available(db,owner){
 const r=await db.query("SELECT a.balance::numeric - COALESCE(SUM(h.amount) FILTER (WHERE h.state='ACTIVE'),0) AS available FROM paper_ledger_accounts a LEFT JOIN paper_ledger_holds h ON a.account_id=h.account_id AND a.asset=h.asset WHERE a.account_id=$1 AND a.asset='USDC' GROUP BY a.balance",[owner]);
 return Number(r.rows[0].available);
}
(async()=>{
 const db=new Client({connectionString:url});await db.connect();
 try{
  await db.query("INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES ('USDC','paper_alice_r25',100),('BTC','paper_alice_r25',2),('USDC','paper_bob_r25',100),('BTC','paper_bob_r25',2)");
  await reservePaperHold(db,{id:'r25_hold',owner:'paper_alice_r25',asset:'USDC',amount:'30.00'});
  assert.equal(await available(db,'paper_alice_r25'),70);
  const handler=createHandler({env});
  assert.equal((await invoke(handler,'paper_bob_r25')).status,409,'cross-owner cannot cancel');
  assert.equal((await invoke(handler,null)).status,401);
  assert.equal((await invoke(handler,'paper_alice_r25',{id:'nonexistent'})).status,409);
  assert.equal((await invoke(handler,'paper_alice_r25',{id:'r25_hold',owner:'paper_bob_r25'})).status,400);
  assert.equal((await invoke(handler,'paper_alice_r25',undefined,{origin:'https://evil.invalid'})).status,403);
  assert.equal(await available(db,'paper_alice_r25'),70);
  const firstTwo=await Promise.all([
   invoke(handler,'paper_alice_r25'),invoke(handler,'paper_alice_r25')]);
  assert.deepEqual(firstTwo.map(r=>r.status),[200,200]);
  assert.deepEqual(firstTwo.map(r=>r.body.replayed).sort(),[false,true],
   'concurrent cancels must release exactly once');
  assert.equal(await available(db,'paper_alice_r25'),100);
  const repeat=await invoke(handler,'paper_alice_r25');
  assert.equal(repeat.status,200);assert.equal(repeat.body.replayed,true);
  const old=await reservePaperHold(db,{id:'r25_hold',owner:'paper_alice_r25',asset:'USDC',amount:'30.00'});
  assert.equal(old.state,'RELEASED','reserve replay must not resurrect canceled funds');
  assert.equal(await available(db,'paper_alice_r25'),100);
  assert.equal(await available(db,'paper_bob_r25'),100);
  const stored=await db.query("SELECT state,count(*)::int AS n FROM paper_ledger_holds WHERE id='r25_hold' GROUP BY state");
  assert.equal(stored.rows.length,1);
  assert.equal(stored.rows[0].state,'RELEASED');
  assert.equal(stored.rows[0].n,1);
  console.log('PASS R025: real PostgreSQL concurrent idempotent release, no foreign release, no resurrected hold');
 }finally{await db.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
