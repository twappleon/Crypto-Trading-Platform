'use strict';
// R022: anonymous public HTTPS endpoint must NEVER expose paper account holdings or write.
const assert=require('node:assert/strict');
const root=new URL(process.env.SITE_URL||'https://crypto-trading-platform-demo.vercel.app/');
const url=new URL('/api/paper-holds?account=treasury',root);
assert.equal(url.protocol,'https:');
(async()=>{
 const get=await fetch(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
 assert.ok([401,503].includes(get.status),'anonymous hold GET must fail closed; got '+get.status);
 assert.match(get.headers.get('cache-control')||'',/no-store/);
 assert.equal(get.headers.get('access-control-allow-origin'),null);
 const payload=await get.json();
 assert.equal(payload.mode,'PAPER_SANDBOX');
 assert.equal(payload.holds,undefined);
 assert.ok(['UNAUTHORIZED','PAPER_BACKEND_NOT_CONFIGURED'].includes(payload.error));
 const post=await fetch(url,{method:'POST',redirect:'error',credentials:'omit',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'treasury',privateKey:'fake'}),
  signal:AbortSignal.timeout(20000)});
 assert.equal(post.status,405);
 const refused=await post.json();
 assert.equal(refused.error,'METHOD_NOT_ALLOWED');
 assert.ok(!JSON.stringify(refused).includes('privateKey'));
 console.log('PASS R022: public anonymous HTTPS hold reads 401/503 and writes 405, no tenant leaks');
})().catch(e=>{console.error(e);process.exitCode=1});
