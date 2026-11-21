'use strict';
// Public safe-denial release gate. Never generate or transmit a real credential.
const assert=require('node:assert/strict');
const base=new URL(process.env.SITE_URL||'https://crypto-trading-platform-demo.vercel.app/');
const url=new URL('/api/paper-release',base);
assert.equal(url.protocol,'https:');
(async()=>{
 const get=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(get.status,405,'public release endpoint GET must be forbidden');
 assert.equal((await get.json()).error,'METHOD_NOT_ALLOWED');
 const post=await fetch(url,{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:'public-denied',owner:'treasury'}),
  redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.ok([401,503].includes(post.status),'anonymous public cancellation must fail: '+post.status);
 const denied=await post.json();
 assert.equal(denied.mode,'PAPER_SANDBOX');
 assert.ok(['UNAUTHORIZED','PAPER_RESERVATIONS_DISABLED'].includes(denied.error));
 assert.equal(post.headers.get('access-control-allow-origin'),null);
 assert.match(post.headers.get('cache-control')||'',/no-store/);
 assert.doesNotMatch(JSON.stringify(denied),/public-denied|treasury|password|privateKey/);
 console.log('PASS R025: public HTTPS PAPER release route exists and refuses anonymous write');
})().catch(e=>{console.error(e);process.exitCode=1});
