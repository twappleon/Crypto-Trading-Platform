'use strict';
// Round 018 public, anonymous HTTPS API negative security gate.
// Never use real credentials, live funds or any KYC data.
const assert=require('node:assert/strict');
const root=new URL(process.env.SITE_URL||'https://crypto-trading-platform-demo.vercel.app/');
const api=new URL('/api/paper-balances',root);
assert.equal(api.protocol,'https:');
(async()=>{
 const GET=await fetch(api,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
  signal:AbortSignal.timeout(20000)});
 assert.ok(GET.status===401||GET.status===503,
  'anonymous balance GET must not expose any account; expect 401 configured or 503 disabled, got '+GET.status);
 assert.match(GET.headers.get('cache-control')||'',/no-store/);
 assert.equal(GET.headers.get('access-control-allow-origin'),null);
 const body=await GET.json();
 assert.equal(body.mode,'PAPER_SANDBOX');
 assert.equal(body.balances,undefined);
 assert.ok(body.error==='UNAUTHORIZED'||body.error==='PAPER_BACKEND_NOT_CONFIGURED');
 const POST=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({owner:'treasury',wallet:'fake',privateKey:'fake-only'}),
  redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 assert.equal(POST.status,405,'public write method must be rejected, no database operation');
 const refused=await POST.json();
 assert.equal(refused.error,'METHOD_NOT_ALLOWED');
 assert.ok(!JSON.stringify(refused).includes('privateKey'));
 console.log('PASS: PUBLIC HTTPS /api/paper-balances anonymous 401/503, no account exposure, POST 405');
})().catch(e=>{console.error('R018 public API negative gate FAILED:',e);process.exitCode=1});
