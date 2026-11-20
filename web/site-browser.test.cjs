'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

(async () => {
  let server;
  let site = process.env.SITE_URL;
  if (!site) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    server = http.createServer((req, res) => {
      if (req.url !== '/' && req.url !== '/index.html') {
        res.writeHead(404); res.end('Not found'); return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    site = 'http://127.0.0.1:' + server.address().port + '/';
  }
  fs.mkdirSync('artifacts', { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const mode of [{ name: 'desktop', width: 1366, height: 768 }, { name: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: mode.width, height: mode.height }, deviceScaleFactor: 1 });
      const crossOrigin = [];
      page.on('request', request => { if (new URL(request.url()).origin !== new URL(site).origin) crossOrigin.push(request.url()); });
      const response = await page.goto(site, { waitUntil: 'load' });
      assert.equal(response.status(), 200, mode.name + ' must get HTTP 200');
      assert.equal(await page.locator('#usdc').textContent(), '100,000.00');
      assert.equal(await page.locator('#btc').textContent(), '2.000000');
      assert.ok((await page.locator('body').innerText()).includes('PAPER / SANDBOX'));
      assert.ok((await page.locator('body').innerText()).includes('Synthetic market data'));
      assert.ok((await page.locator('body').innerText()).includes('Prototype v0.6'));
      await page.locator('#price').fill('64275');
      await page.locator('#amount').fill('1');
      assert.match(await page.locator('#riskPreview').textContent(), /Hold: 64,275\.00 USDC/);
      await page.locator('#submit').click();
      assert.equal(await page.locator('#count').textContent(), '1 open');
      assert.equal(await page.locator('#usdc').textContent(), '35,725.00');
      assert.equal(await page.locator('#usdcLocked').textContent(), 'Locked: 64,275.00');
      const [exported] = await Promise.all([page.waitForEvent('download'), page.locator('#exportHistory').click()]);
      assert.equal(exported.suggestedFilename(), 'atlas-paper-session.json');
      const snapshot=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));
      assert.equal(snapshot.mode,'PAPER_BROWSER_ONLY');
      assert.equal(snapshot.storage,'volatile_memory');
      assert.equal(snapshot.executions,0);
      assert.equal(snapshot.records[0].priceCents,6427500);
      assert.equal(snapshot.records[0].quantityMicroBTC,1000000);
      assert.equal(snapshot.records[0].status,'OPEN');
      const oldCancel = await page.locator('[data-id]').first().elementHandle();
      await page.locator('#reset').click();
      await page.locator('#exportHistory').click();
      assert.match(await page.locator('#message').textContent(), /No local demo history/);
      await page.locator('#amount').fill('1');
      await page.locator('#submit').click();
      await oldCancel.evaluate(node => node.click()); // detached DOM handler from previous reset
      assert.equal(await page.locator('#count').textContent(), '1 open', 'stale cancel must never unlock a newer order');
      await page.locator('#submit').click(); // overdraft must fail without adding order
      assert.match(await page.locator('#message').textContent(), /Insufficient available/);
      assert.match(await page.locator('#riskPreview').textContent(), /Insufficient demo balance/, 'pre-submit reserve risk is visible');
      assert.equal(await page.locator('#count').textContent(), '1 open');
      await page.locator('#sellTab').click();
      await page.locator('#amount').fill('1.5');
      assert.match(await page.locator('#riskPreview').textContent(), /Hold: 1\.500000 BTC/);
      await page.locator('#submit').click();
      assert.equal(await page.locator('#count').textContent(), '2 open');
      assert.equal(await page.locator('#btc').textContent(), '0.500000');
      await page.locator('#cancelAll').click();
      assert.equal(await page.locator('#count').textContent(), '0 open');
      assert.equal(await page.locator('#usdc').textContent(), '100,000.00');
      assert.equal(await page.locator('#btc').textContent(), '2.000000');
      assert.equal(await page.locator('#usdcLocked').textContent(), 'Locked: 0.00');
      assert.equal(await page.locator('#btcLocked').textContent(), 'Locked: 0.000000');
      assert.equal(await page.locator('#history tr').filter({ hasText: 'CANCELED' }).count(), 2);
      await page.locator('#cancelAll').click(); // repeated empty cancel is a no-op
      assert.equal(await page.locator('#history tr').filter({ hasText: 'CANCELED' }).count(), 2);
      // R011: real desktop + 390px mobile guard against fractional-cent paper overbooking.
      await page.locator('#buyTab').click();
      await page.locator('#price').fill('64275.01');
      await page.locator('#amount').fill('0.000001');
      assert.match(await page.locator('#riskPreview').textContent(), /Hold: 0\.07 USDC/);
      await page.locator('#submit').click();
      assert.equal(await page.locator('#usdcLocked').textContent(), 'Locked: 0.07');
      assert.equal(await page.locator('#usdc').textContent(), '99,999.93');
      await page.locator('#cancelAll').click();
      assert.equal(await page.locator('#usdcLocked').textContent(), 'Locked: 0.00');
      assert.equal(await page.locator('#usdc').textContent(), '100,000.00');
      await page.screenshot({ path: 'artifacts/site-' + mode.name + '.png', fullPage: true });
      assert.deepEqual(crossOrigin, [], 'offline demo must not call third parties');
      await page.reload();
      assert.equal(await page.locator('#count').textContent(), '0 open');
      assert.equal(await page.locator('#usdc').textContent(), '100,000.00');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 2, mode.name + ' should not horizontally overflow viewport: ' + overflow);
      await page.close();
      console.log('PASS: R013 offline JSON export + real Chromium ' + mode.name + ' PAPER order/cancel/reset/mobile E2E');
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
