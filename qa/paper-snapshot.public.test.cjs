'use strict';
// R023 public logged-out HTTPS negative gate. No secrets or private data.
const assert=require('node:assert/strict');
const base=new URL(process.env.SITE_URL||'https://crypto-trading-platform-demo.vercel.app/');
const api=new URL('/api/paper-snapshot?owner=treasury',base);
assert.equal(api.protocol,'https:');
(async()=>{
 const read=await fetch(api,{method:'GET',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(20000)});
 assert.ok([401,503].includes(read.status),'anonymous paper snapshot GET must be denied: '+read.status);
 assert.match(read.headers.get('cache-control')||'',/no-store/);
 assert.equal(read.headers.get('access-control-allow-origin'),null);
 const data=await read.json();
 assert.equal(data.mode,'PAPER_SANDBOX');assert.equal(data.balances,undefined);
 assert.equal(data.holds,undefined);
 assert.ok(['UNAUTHORIZED','PAPER_BACKEND_NOT_CONFIGURED'].includes(data.error));
 const write=await fetch(api,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({privateKey:'fake',owner:'treasury'}),signal:AbortSignal.timeout(20000)});
 assert.equal(write.status,405);
 const denied=await write.json();
 assert.equal(denied.error,'METHOD_NOT_ALLOWED');
 assert.ok(!JSON.stringify(denied).includes('privateKey'));
 console.log('PASS R023: public anonymous HTTPS snapshot read 401/503, POST 405, no account records');
})().catch(e=>{console.error(e);process.exitCode=1});
