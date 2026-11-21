'use strict';
// Public release negative gate: unsigned PAPER writes must never be enabled.
const assert=require('node:assert/strict');
const base=new URL(process.env.SITE_URL||'https://crypto-trading-platform-demo.vercel.app/');
const api=new URL('/api/paper-reserve',base);
assert.equal(api.protocol,'https:');
(async()=>{
 const get=await fetch(api,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(get.status,405,'public paper reservation route must reject GET');
 const read=await get.json();assert.equal(read.error,'METHOD_NOT_ALLOWED');
 const post=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:'public-forbidden',asset:'USDC',amount:'1.00',owner:'treasury'}),
  redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.ok([401,503].includes(post.status),'unsigned public writes must be denied: '+post.status);
 const denial=await post.json();
 assert.equal(denial.mode,'PAPER_SANDBOX');
 assert.ok(['UNAUTHORIZED','PAPER_RESERVATIONS_DISABLED'].includes(denial.error));
 assert.equal(post.headers.get('access-control-allow-origin'),null);
 assert.match(post.headers.get('cache-control')||'',/no-store/);
 assert.doesNotMatch(JSON.stringify(denial),/treasury|public-forbidden|privateKey/);
 console.log('PASS R024: public HTTPS unsigned PAPER reserve denied; no public order entry');
})().catch(e=>{console.error(e);process.exitCode=1});
