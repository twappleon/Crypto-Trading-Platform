'use strict';
// R020 local negative BDD: malformed reservations cannot begin a database transaction.
const assert=require('node:assert/strict');
const {normalizeAmount,checkId,reservePaperHold,cancelPaperHold}=require('./paper-reservations.cjs');
assert.equal(normalizeAmount('USDC','0.01'),10000000000000000n);
assert.equal(normalizeAmount('BTC','0.000001'),1000000000000n);
for(const [asset,amount] of [['BTC','0'],['BTC','-1'],['BTC','1e-6'],
 ['BTC','0.0000001'],['USDC','0.001'],['USDC','01.00'],
 ['USDC','100000000000000000000'],['ETH','1'],['BTC','Infinity'],['BTC','NaN']]){
 assert.throws(()=>normalizeAmount(asset,amount),{code:'PAPER_BAD_AMOUNT'});
}
for(const id of ['', 'treasury','../bad','a'.repeat(97),null]){
 assert.throws(()=>checkId(id),{code:'PAPER_BAD_ID'});
}
let calls=0;
const denyClient={query(){calls++;throw Error('untrusted request touched database')}};
(async()=>{
 for(const request of [{id:'bad!!',owner:'qa_a',asset:'USDC',amount:'1.00'},
  {id:'ok',owner:'treasury',asset:'USDC',amount:'1.00'},
  {id:'ok',owner:'qa_a',asset:'USDC',amount:'1.001'}]){
  await assert.rejects(()=>reservePaperHold(denyClient,request));
 }
 await assert.rejects(()=>cancelPaperHold(denyClient,{id:'a',owner:'treasury'}));
 assert.equal(calls,0,'invalid identity or amounts must be rejected before opening transaction');
 // R021 deterministic negative BDD: an earlier read observes ACTIVE while
 // a cancellation commits before the account row lock is acquired. Never reply ACTIVE.
 let replayReads=0,accountLocks=0,insertions=0;
 const replayClient={async query(sql){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rowCount:0,rows:[]};
  if(sql.startsWith('SELECT id,account_id,asset,amount::text AS amount,state')){
   replayReads++;
   return {rowCount:1,rows:[{id:'r21_id',account_id:'alice',asset:'USDC',amount:'5.00',
    state:replayReads===1?'ACTIVE':'RELEASED'}]};
  }
  if(sql.startsWith('SELECT balance::text AS total FROM paper_ledger_accounts')){
   accountLocks++;
   return {rowCount:1,rows:[{total:'100.00'}]};
  }
  if(sql.startsWith('INSERT'))insertions++;
  throw Error('unexpected query '+sql);
 }};
 const settled=await reservePaperHold(replayClient,{id:'r21_id',owner:'alice',asset:'USDC',amount:'5'});
 assert.deepEqual({state:settled.state,replayed:settled.replayed},
  {state:'RELEASED',replayed:true},'replay after concurrent cancel must not report stale ACTIVE');
 assert.equal(replayReads,2,'replay must recheck durable state after account lock');
 assert.equal(accountLocks,1,'replay must acquire the same row lock as cancellation');
 assert.equal(insertions,0,'replay must never reinsert an existing hold');
 console.log('PASS R021: post-lock replay reflects concurrent cancel, no stale or duplicate reserve');
 console.log('PASS R020: PAPER reserve/cancel strict precision, owner, negative input and no DB access');
})().catch(e=>{console.error(e);process.exitCode=1});
