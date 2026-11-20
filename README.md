# Crypto Trading Platform — PAPER / SANDBOX

> **Release status: NOT LIVE.** The public Vercel production deployment is blocked by a Hobby-team daily deployment quota (HTTP 402, `api-deployments-free-per-day` as of 2026-11-21). This repository link is **not** a public working trading site. Do not send any cryptocurrency, keys or KYC documents.

## Website-first P0
The `main` branch contains the static responsive v0.3 paper trading terminal in [`web/index.html`](web/index.html): fabricated BTC/USDC chart/depth, simulated buy/sell limit orders, available/locked demo funds, single/bulk cancellation, safe reset and session history displaying only **OPEN** and **CANCELED**. Reload clears the session. There are no fills, matching, live prices, persistent balances, external API calls or custody. The display is a local educational demonstration.

```bash
node web/site-smoke.test.cjs
node web/site-interaction.test.cjs
```

[Website CI](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml) · [Website deployment gate](docs/SITE_RELEASE.md) · [BDD scenarios](docs/BDD.md) · [PRD](docs/PRD.md) · [100-round progress](docs/PROGRESS.md)

Vercel project `crypto-trading-platform-demo` is linked to GitHub `main`, root `web`, no deployment authentication protection. **There is currently no READY deployment or verified HTTPS URL.** Site work cannot be accepted until CI on the exact SHA plus real public HTTP/browser/mobile E2E are confirmed.

## Backend development (separate branch)
The [backend feature branch](https://github.com/twappleon/Crypto-Trading-Platform/tree/feat/round-002-postgres-ledger-20261120) and [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1) contain a Java 21/PostgreSQL paper ledger, holds, order reservations, explicit-pair atomic settlement, maker/taker fee logic, and transactional outbox. R002–R008 have **7 Accepted / 100** recorded independent test/CI outcomes. These modules are not merged into the website, and are **not** production funds-safe. The website currently uses only local simulated state.

Round 010 adds Cancel All and guards stale cancellation handlers after reset. Site release remains unverified. Next P0: unblock Vercel production quota, deploy the latest `main`, prove public HTTPS and interactive desktop/mobile browser behavior. After that, integrate persistent sandbox backend with authentication, reconciliation, FIFO replay and safety gates. **No real trading, deposits, withdrawals, wallet keys or customer KYC.**

## Browser QA
```bash
npm install --no-save --no-package-lock playwright@1.64.1
npx playwright install --with-deps chromium
node web/site-browser.test.cjs
# Once a public, deployed PAPER site exists:
# SITE_URL=https://<VERIFIED-PRODUCTION-HOST> node web/site-browser.test.cjs
```
The real Chromium check covers desktop and 390px mobile, captures screenshots as CI artifacts and verifies simulated balances, Cancel All, stale handlers, reload and no third-party traffic. **A local browser pass does not prove the Vercel public domain is live.**
