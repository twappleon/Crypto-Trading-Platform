'use strict';
// Public release gate: HTTPS content verification only, PAPER/SANDBOX. No secrets or credentials.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.SITE_URL || 'https://crypto-trading-platform-demo.vercel.app/';
(async () => {
  const target = new URL(url);
  assert.equal(target.protocol, 'https:', 'public release must use HTTPS');
  const response = await fetch(target, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
  console.log('PUBLIC_SITE_URL=' + target.href);
  console.log('HTTP_STATUS=' + response.status);
  console.log('FINAL_URL=' + response.url);
  assert.equal(response.status, 200, 'production must serve HTTP 200 without login');
  const published = await response.text();
  for (const term of ['PAPER / SANDBOX', 'Synthetic market data', 'Cancel all open demo orders', 'Prototype v0.9', 'no real executions']) {
    assert.ok(published.includes(term), 'public site is missing release marker: ' + term);
  }
  const local = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const hash = str => crypto.createHash('sha256').update(str).digest('hex');
  console.log('SOURCE_SHA256=' + hash(local));
  console.log('PUBLIC_SHA256=' + hash(published));
  assert.equal(hash(published), hash(local), 'public HTML differs from main/web/index.html');
  // R015: proof of the publicly deployed read-only diagnostic. No authentication secrets.
  const api=new URL('/api/paper-status',target);
  const apiGet=await fetch(api,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  assert.equal(apiGet.status,200,'public PAPER diagnostic GET must exist');
  const diagnostics=await apiGet.json();
  assert.equal(diagnostics.mode,'PAPER_SANDBOX');
  assert.equal(diagnostics.readiness,'NOT_READY');
  assert.equal(diagnostics.durablePostgresConnected,false);
  assert.equal(diagnostics.publicAuthenticatedApi,false);
  assert.equal(diagnostics.orderEntryEnabled,false);
  const denied=await fetch(api,{method:'POST',body:JSON.stringify({order:'forbidden'}),headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
  assert.equal(denied.status,405,'public status endpoint must reject order submissions');
  console.log('PASS: public HTTPS exact v0.9 HTML, API GET NOT_READY and POST 405; no real trades');

})().catch(e => { console.error('PUBLIC RELEASE GATE FAILED:', e); process.exitCode = 1; });
