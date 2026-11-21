'use strict';
// R019 BDD: malformed/incomplete/inconsistent database snapshots NEVER look READY.
// Fixed-point BigInt arithmetic, intentionally no floating-point approximation.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {units,verifyBalanceRows}=require('./paper-balance-invariants.cjs');
const {createHandler}=require('./api/paper-balances.js');
const good=[
 {asset:'BTC',total:'2.000000000000000001',locked:'0.500000000000000001',available:'1.500000000000000000'},
 {asset:'USDC',total:'100.000000000000000000',locked:'30.01',available:'69.990000000000000000'}
];
assert.equal(units('0.000000000000000001'),1n);
assert.equal(units('1.000000000000000001'),1000000000000000001n);
assert.deepEqual(verifyBalanceRows(good),good);
assert.equal(verifyBalanceRows(good.map(r=>({...r,serverSecret:'never expose'})))[0].serverSecret,undefined);
const invalid=[
 [],[good[0]],[good[0],good[0]], [good[1],good[1]], [good[0],{...good[1],asset:'ETH'}],
 [good[0],{...good[1],locked:'100.01'}],
 [good[0],{...good[1],available:'69.98'}],
 [good[0],{...good[1],available:'69.990000000000000001'}],
 [good[0],{...good[1],total:'-100.00'}],
 [good[0],{...good[1],total:'1e2'}],
 [good[0],{...good[1],total:'100.0000000000000000001'}],
 [good[0],{...good[1],total:'100000000000000000000.00'}],
 [good[0],{...good[1],available:'NaN'}],
 [good[0],{...good[1],available:null}],
 [good[0],null]
];
for(const rows of invalid)assert.throws(()=>verifyBalanceRows(rows),'corrupt database snapshot must fail closed');
const secret='unit-only-hmac-secret-never-deploy-01234567890123',now=1795235400000;
const payload=Buffer.from(JSON.stringify({sub:'qa_user',scope:'paper:balances:read',exp:Math.floor(now/1000)+120})).toString('base64url');
const signature=crypto.createHmac('sha256',secret).update('v1.'+payload).digest('base64url');
const token='Bearer v1.'+payload+'.'+signature;
async function invoke(rows){
 const handler=createHandler({env:{PAPER_DATABASE_URL:'postgresql://not-real.example/paper',PAPER_SESSION_SECRET:secret},now:()=>now,lookup:async()=>rows});
 let data,status;
 await handler({method:'GET',headers:{authorization:token}},{
  statusCode:200,setHeader(){},end(body){data=JSON.parse(body);status=this.statusCode}
 });
 return {data,status};
}
(async()=>{
 const ok=await invoke(good);
 assert.equal(ok.status,200);
 assert.deepEqual(ok.data.balances,good);
 for(const rows of invalid){
  const r=await invoke(rows);
  assert.equal(r.status,503,'inconsistent synthetic ledger data must not be served');
  assert.deepEqual(r.data,{mode:'PAPER_SANDBOX',error:'PAPER_BALANCES_UNAVAILABLE'});
  assert.equal(r.data.balances,undefined);
 }
 console.log('PASS R019: 18-digit fixed-point conservation, complete BTC/USDC, duplicate/negative/overprecision/mismatch fail-closed');
})().catch(e=>{console.error(e);process.exitCode=1});
