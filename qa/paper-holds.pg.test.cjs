'use strict';
// R022 real PostgreSQL 16 integration. Only isolated CI-created disposable PAPER accounts.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('../web/node_modules/pg');
const {createHandler}=require('../web/api/paper-holds.js');
const connectionString=process.env.PAPER_DATABASE_URL,secret=process.env.PAPER_SESSION_SECRET;
assert.ok(connectionString&&secret&&secret.length>=32);
function bearer(owner,scope='paper:holds:read'){
 const payload=Buffer.from(JSON.stringify({sub:owner,scope,exp:Math.floor(Date.now()/1000)+180})).toString('base64url');
 return 'Bearer v1.'+payload+'.'+crypto.createHmac('sha256',secret).update('v1.'+payload).digest('base64url');
}
async function invoke(handler,owner,method='GET',scope='paper:holds:read'){
 const response={statusCode:200,setHeader(){},end(data){this.body=data;this.calls=(this.calls||0)+1}};
 await handler({method,headers:{authorization:owner?bearer(owner,scope):undefined},
  url:'/api/paper-holds?account=qa_bob',body:{account:'qa_bob'}},response);
 assert.equal(response.calls,1);
 return {status:response.statusCode,body:response.body?JSON.parse(response.body):null};
}
(async()=>{
 const db=new Client({connectionString});
 await db.connect();
 try {
  // Earlier QA jobs in this same run create accounts and holds.
  const handler=createHandler();
  const a=await invoke(handler,'qa_alice');
  assert.equal(a.status,200);
  assert.deepEqual(a.body.holds.map(h=>h.id).sort(),['qa_hold_a','qa_hold_btc','qa_hold_released']);
  assert.equal(a.body.holds.find(h=>h.id==='qa_hold_a').state,'ACTIVE');
  assert.equal(a.body.holds.find(h=>h.id==='qa_hold_released').state,'RELEASED');
  assert.equal(a.body.holds.some(h=>h.id==='qa_hold_b'),false,'Alice must not see Bob hold');
  const b=await invoke(handler,'qa_bob');
  assert.equal(b.status,200);
  assert.deepEqual(b.body.holds.map(h=>h.id),['qa_hold_b']);
  assert.equal((await invoke(handler,'qa_alice','GET','paper:balances:read')).status,401);
  assert.equal((await invoke(handler,null)).status,401);
  assert.equal((await invoke(handler,'qa_alice','POST')).status,405);
  // Actual UPDATE visible after new authenticated READ ONLY transaction.
  await db.query("UPDATE paper_ledger_holds SET state='RELEASED' WHERE id='qa_hold_a'");
  assert.equal((await invoke(handler,'qa_alice')).body.holds.find(h=>h.id==='qa_hold_a').state,'RELEASED');
  await db.query("UPDATE paper_ledger_holds SET state='ACTIVE' WHERE id='qa_hold_a'");
  // NUMERIC(38,18) accepts too much precision; endpoint MUST fail closed.
  await db.query("UPDATE paper_ledger_holds SET amount=0.001 WHERE id='qa_hold_a'");
  const corrupt=await invoke(handler,'qa_alice');
  assert.equal(corrupt.status,503);assert.equal(corrupt.body.holds,undefined);
  await db.query("UPDATE paper_ledger_holds SET amount=30 WHERE id='qa_hold_a'");
  assert.equal((await invoke(handler,'qa_alice')).status,200);
  // Truncation must NOT present incomplete owner history as a complete snapshot.
  await db.query("INSERT INTO paper_ledger_holds(id,asset,account_id,amount,state) SELECT 'r22-limit-'||g,'USDC','qa_bob',1,'RELEASED' FROM generate_series(1,101) g");
  assert.equal((await invoke(handler,'qa_bob')).status,503,'101-row limit must fail closed');
  await db.query("DELETE FROM paper_ledger_holds WHERE id LIKE 'r22-limit-%'");
  assert.equal((await invoke(handler,'qa_bob')).status,200);
  console.log('PASS R022: real PostgreSQL 16 owner-scoped holds, durable release visibility, malformed precision and 101-row fail-closed gate');
 } finally {await db.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
