'use strict';
// R024 real disposable PostgreSQL 16 BDD. No public orders or real funds.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('../web/node_modules/pg');
const {createHandler}=require('../web/api/paper-reserve.js');
const {cancelPaperHold}=require('../web/paper-reservations.cjs');
const url=process.env.PAPER_DATABASE_URL,secret=process.env.PAPER_SESSION_SECRET;
assert.ok(url&&secret&&secret.length>=32);
const env={PAPER_DATABASE_URL:url,PAPER_SESSION_SECRET:secret,
 PAPER_RESERVATIONS_WRITE_ENABLED:'sandbox-only'};
function token(sub){
 const p=Buffer.from(JSON.stringify({sub,scope:'paper:reservations:write',
  exp:Math.floor(Date.now()/1000)+120})).toString('base64url');
 return 'Bearer v1.'+p+'.'+crypto.createHmac('sha256',secret).update('v1.'+p).digest('base64url');
}
async function invoke(handler,owner,body,headers={}){
 const res={statusCode:200,setHeader(){},end(raw){this.calls=(this.calls||0)+1;this.raw=raw}};
 await handler({method:'POST',headers:{authorization:owner?token(owner):undefined,
  'content-type':'application/json',...headers},body,url:'/api/paper-reserve?owner=paper_bob_r24'},res);
 assert.equal(res.calls,1);
 return {status:res.statusCode,body:JSON.parse(res.raw)};
}
(async()=>{
 const db=new Client({connectionString:url});await db.connect();
 try{
  // Dedicated disposable synthetic accounts in existing isolated CI schema.
  await db.query("INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES ('USDC','paper_alice_r24',100),('BTC','paper_alice_r24',2),('USDC','paper_bob_r24',70),('BTC','paper_bob_r24',2)");
  const handler=createHandler({env});
  const body={id:'r24_hold_1',asset:'USDC',amount:'30.00'};
  const first=await invoke(handler,'paper_alice_r24',body);
  assert.equal(first.status,201);assert.equal(first.body.state,'ACTIVE');
  assert.equal(first.body.orderEntryEnabled,false);
  const repeated=await invoke(handler,'paper_alice_r24',{...body,amount:'30'});
  assert.equal(repeated.status,200);assert.equal(repeated.body.replayed,true);
  assert.equal((await invoke(handler,'paper_bob_r24',body)).status,409);
  assert.equal((await invoke(handler,'paper_alice_r24',{...body,amount:'40'})).status,409);
  assert.equal((await invoke(handler,'paper_alice_r24',{id:'r24_over',asset:'USDC',amount:'70.01'})).status,409);
  assert.equal((await invoke(handler,'paper_alice_r24',{id:'r24_bad',asset:'USDC',amount:'0.001'})).status,400);
  assert.equal((await invoke(handler,'paper_alice_r24',body,{origin:'https://evil.invalid'})).status,403);
  assert.equal((await invoke(handler,null,body)).status,401);
  const read=await db.query("SELECT amount::text,state FROM paper_ledger_holds WHERE id='r24_hold_1'");
  assert.equal(read.rowCount,1);assert.equal(Number(read.rows[0].amount),30);assert.equal(read.rows[0].state,'ACTIVE');
  const bob=await db.query("SELECT count(*)::int AS n FROM paper_ledger_holds WHERE account_id='paper_bob_r24'");
  assert.equal(bob.rows[0].n,0,'foreign owner cannot create or replay another hold');
  assert.equal((await cancelPaperHold(db,{id:'r24_hold_1',owner:'paper_alice_r24'})).state,'RELEASED');
  const after=await invoke(handler,'paper_alice_r24',body);
  assert.equal(after.status,200);assert.equal(after.body.state,'RELEASED');
  const still=await db.query("SELECT count(*)::int AS n FROM paper_ledger_holds WHERE id='r24_hold_1'");
  assert.equal(still.rows[0].n,1,'released reservation is not resurrected');
  const locked=await db.query("SELECT COALESCE(SUM(amount),0)::text AS v FROM paper_ledger_holds WHERE account_id='paper_alice_r24' AND asset='USDC' AND state='ACTIVE'");
  assert.equal(Number(locked.rows[0].v),0,'released funds are never double-held');
  console.log('PASS R024: PostgreSQL 16 opted-in PAPER reserve, replay, isolation, disabled browser, no duplicate or overdraft');
 }finally{await db.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
