'use strict';
// R023 real isolated PostgreSQL 16 BDD, run after R018/R022 fixture verification.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('../web/node_modules/pg');
const {createHandler}=require('../web/api/paper-snapshot.js');
const secret=process.env.PAPER_SESSION_SECRET,url=process.env.PAPER_DATABASE_URL;
assert.ok(secret&&secret.length>=32&&url);
function bearer(sub,scope='paper:snapshot:read'){
 const b=Buffer.from(JSON.stringify({sub,scope,exp:Math.floor(Date.now()/1000)+120})).toString('base64url');
 return 'Bearer v1.'+b+'.'+crypto.createHmac('sha256',secret).update('v1.'+b).digest('base64url');
}
async function invoke(handler,owner,method='GET',scope='paper:snapshot:read'){
 const res={statusCode:200,setHeader(){},end(raw){this.raw=raw;this.calls=(this.calls||0)+1}};
 await handler({method,url:'/api/paper-snapshot?owner=qa_bob',headers:{authorization:owner?bearer(owner,scope):undefined},
  body:{owner:'qa_bob'}},res);
 assert.equal(res.calls,1);
 return {status:res.statusCode,body:res.raw?JSON.parse(res.raw):null};
}
(async()=>{
 const db=new Client({connectionString:url});await db.connect();
 try{
  const handler=createHandler();
  const a=await invoke(handler,'qa_alice');
  assert.equal(a.status,200);assert.equal(a.body.consistentSnapshot,true);
  const assets=Object.fromEntries(a.body.balances.map(x=>[x.asset,x]));
  assert.equal(Number(assets.USDC.total),90);assert.equal(Number(assets.USDC.locked),30);
  assert.equal(Number(assets.BTC.locked),0.5);
  assert.deepEqual(a.body.holds.map(x=>x.id).sort(),['qa_hold_a','qa_hold_btc','qa_hold_released']);
  const b=await invoke(handler,'qa_bob');
  assert.equal(b.status,200);
  assert.deepEqual(b.body.holds.map(x=>x.id),['qa_hold_b']);
  assert.equal(Number(b.body.balances.find(x=>x.asset==='USDC').total),250);
  assert.equal((await invoke(handler,null)).status,401);
  assert.equal((await invoke(handler,'qa_alice','GET','paper:holds:read')).status,401);
  assert.equal((await invoke(handler,'qa_alice','POST')).status,405);
  await db.query("UPDATE paper_ledger_holds SET state='RELEASED' WHERE id='qa_hold_a'");
  const released=await invoke(handler,'qa_alice');
  assert.equal(released.status,200);
  assert.equal(Number(released.body.balances.find(x=>x.asset==='USDC').locked),0);
  assert.equal(released.body.holds.find(x=>x.id==='qa_hold_a').state,'RELEASED');
  await db.query("UPDATE paper_ledger_holds SET state='ACTIVE' WHERE id='qa_hold_a'");
  await db.query("UPDATE paper_ledger_holds SET amount=100 WHERE id='qa_hold_a'");
  const bad=await invoke(handler,'qa_alice');
  assert.equal(bad.status,503);assert.equal(bad.body.balances,undefined);
  await db.query("UPDATE paper_ledger_holds SET amount=30 WHERE id='qa_hold_a'");
  assert.equal((await invoke(handler,'qa_alice')).status,200);
  await db.query("INSERT INTO paper_ledger_holds(id,asset,account_id,amount,state) SELECT 'r23-overflow-'||g,'USDC','qa_bob',1,'RELEASED' FROM generate_series(1,101) g");
  assert.equal((await invoke(handler,'qa_bob')).status,503);
  await db.query("DELETE FROM paper_ledger_holds WHERE id LIKE 'r23-overflow-%'");
  assert.equal((await invoke(handler,'qa_bob')).status,200);
  console.log('PASS R023: real PostgreSQL 16 same-transaction paper balances/holds, isolation, release, corruption and overflow');
 }finally{await db.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
