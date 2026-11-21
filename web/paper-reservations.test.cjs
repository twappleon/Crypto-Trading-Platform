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
 console.log('PASS R020: PAPER reserve/cancel strict precision, owner, negative input and no DB access');
})().catch(e=>{console.error(e);process.exitCode=1});
