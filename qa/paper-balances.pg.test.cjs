'use strict';
// R018 REAL PostgreSQL integration, isolated CI PostgreSQL 16 only.
// No production data, funds, customer accounts, keys or real orders.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('../web/node_modules/pg');
const {createHandler}=require('../web/api/paper-balances.js');
const url=process.env.PAPER_DATABASE_URL,secret=process.env.PAPER_SESSION_SECRET;
assert.ok(url&&secret&&secret.length>=32,'CI-only PostgreSQL credentials and HMAC secret required');
const token=owner=>{
 const claims=Buffer.from(JSON.stringify({sub:owner,scope:'paper:balances:read',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
 const signature=crypto.createHmac('sha256',secret).update('v1.'+claims).digest('base64url');
 return 'Bearer v1.'+claims+'.'+signature;
};
async function request(handler,owner,method='GET',extra={}){
 let body,ends=0;
 const response={statusCode:200,setHeader(){},end(value){body=value;ends++}};
 await handler({method,url:'/api/paper-balances?account=qa_other',
   headers:{authorization:owner?token(owner):undefined},body:{account:'qa_other',...extra}},response);
 assert.equal(ends,1);
 return {status:response.statusCode,body:body?JSON.parse(body):null};
}
(async()=>{
 const db=new Client({connectionString:url});
 await db.connect();
 try{
  await db.query(`CREATE TABLE paper_ledger_accounts(asset VARCHAR(12) NOT NULL,account_id VARCHAR(96) NOT NULL,
   balance NUMERIC(38,18) NOT NULL DEFAULT 0,PRIMARY KEY(asset,account_id),
   CONSTRAINT nonnegative_user_paper_balance CHECK(account_id='treasury' OR balance>=0))`);
  await db.query(`CREATE TABLE paper_ledger_holds(id VARCHAR(96) PRIMARY KEY, asset VARCHAR(12) NOT NULL,
   account_id VARCHAR(96) NOT NULL,amount NUMERIC(38,18) NOT NULL CHECK(amount>0),
   state VARCHAR(12) NOT NULL CHECK(state IN('ACTIVE','RELEASED')),
   FOREIGN KEY(asset,account_id) REFERENCES paper_ledger_accounts(asset,account_id))`);
  await db.query(`INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES
   ('USDC','qa_alice',100.00),('BTC','qa_alice',2.000000),
   ('USDC','qa_bob',250.00),('BTC','qa_bob',9.000000)`);
  await db.query(`INSERT INTO paper_ledger_holds(id,asset,account_id,amount,state) VALUES
   ('qa_hold_a','USDC','qa_alice',30.00,'ACTIVE'),
   ('qa_hold_released','USDC','qa_alice',10.00,'RELEASED'),
   ('qa_hold_btc','BTC','qa_alice',0.500000,'ACTIVE'),
   ('qa_hold_b','USDC','qa_bob',100.00,'ACTIVE')`);
  const handler=createHandler();
  const alice=await request(handler,'qa_alice');
  assert.equal(alice.status,200);
  assert.equal(alice.body.mode,'PAPER_SANDBOX');
  assert.equal(alice.body.storage,'POSTGRES_PAPER_READ_ONLY');
  assert.equal(alice.body.orderEntryEnabled,false);
  const a=Object.fromEntries(alice.body.balances.map(row=>[row.asset,row]));
  assert.equal(Number(a.USDC.total),100);
  assert.equal(Number(a.USDC.locked),30);
  assert.equal(Number(a.USDC.available),70);
  assert.equal(Number(a.BTC.total),2);
  assert.equal(Number(a.BTC.locked),0.5);
  assert.equal(Number(a.BTC.available),1.5);
  const bob=await request(handler,'qa_bob');
  assert.equal(bob.status,200);
  const b=Object.fromEntries(bob.body.balances.map(row=>[row.asset,row]));
  assert.equal(Number(b.USDC.total),250);
  assert.equal(Number(b.USDC.locked),100);
  assert.equal(Number(b.USDC.available),150);
  assert.equal(Number(b.BTC.total),9);
  assert.equal(Number(b.BTC.locked),0);
  assert.equal((await request(handler,null)).status,401);
  assert.equal((await request(handler,'qa_alice','POST',{action:'place',wallet:'PRIVATE'})).status,405);
  const head=await request(handler,'qa_alice','HEAD');
  assert.equal(head.status,200);assert.equal(head.body,null);
  // Real durable read verification after a separate transaction changes a synthetic balance:
  await db.query(`UPDATE paper_ledger_accounts SET balance=90.00 WHERE asset='USDC' AND account_id='qa_alice'`);
  const after=await request(handler,'qa_alice');
  const updated=after.body.balances.find(r=>r.asset==='USDC');
  assert.equal(Number(updated.total),90);
  assert.equal(Number(updated.available),60);
  const other=await request(handler,'qa_bob');
  assert.equal(Number(other.body.balances.find(r=>r.asset==='USDC').total),250,
   'user A update must not affect user B read');
  // R019: corrupt real database state must FAIL CLOSED; no negative available is served.
  await db.query("UPDATE paper_ledger_holds SET amount=150 WHERE id='qa_hold_a'");
  const overlocked=await request(handler,'qa_alice');
  assert.equal(overlocked.status,503,'active holds above total MUST reject read');
  assert.equal(overlocked.body.error,'PAPER_BALANCES_UNAVAILABLE');
  assert.equal(overlocked.body.balances,undefined);
  await db.query("UPDATE paper_ledger_holds SET amount=30 WHERE id='qa_hold_a'");
  assert.equal((await request(handler,'qa_alice')).status,200,'consistent restored state is readable');
  await db.query("DELETE FROM paper_ledger_accounts WHERE asset='BTC' AND account_id='qa_bob'");
  const missingAsset=await request(handler,'qa_bob');
  assert.equal(missingAsset.status,503,'missing BTC asset MUST NOT be presented as complete snapshot');
  await db.query("INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES ('BTC','qa_bob',9)");
  assert.equal((await request(handler,'qa_bob')).status,200,'restored isolated account is readable');
  // SQL validation preserves the read-only guarantee: no successful mutation through endpoint.
  const persisted=await db.query("SELECT balance::text FROM paper_ledger_accounts WHERE asset='USDC' AND account_id='qa_alice'");
  assert.equal(Number(persisted.rows[0].balance),90);
  console.log('PASS: R018/R019 REAL PostgreSQL 16 paper reads, corrupt holds and missing asset reject, isolation and restore BDD');
 }finally{await db.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
