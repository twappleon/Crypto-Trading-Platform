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
  for (const term of ['PAPER / SANDBOX', 'Synthetic market data', 'Cancel all open demo orders', 'Prototype v0.7', 'no executions']) {
    assert.ok(published.includes(term), 'public site is missing release marker: ' + term);
  }
  const local = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const hash = str => crypto.createHash('sha256').update(str).digest('hex');
  console.log('SOURCE_SHA256=' + hash(local));
  console.log('PUBLIC_SHA256=' + hash(published));
  assert.equal(hash(published), hash(local), 'public HTML differs from main/web/index.html');
  console.log('PASS: public HTTPS 200 and byte-for-byte matching PAPER v0.6 website');
})().catch(e => { console.error('PUBLIC RELEASE GATE FAILED:', e); process.exitCode = 1; });
