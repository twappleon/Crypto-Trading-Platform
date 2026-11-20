# Crypto Trading Platform — PAPER / SANDBOX

> **PAPER SITE IS PUBLICLY REACHABLE:** [Open the synthetic trading demo](https://crypto-trading-platform-demo.vercel.app/). GitHub Actions verified logged-out HTTPS 200, matching current `main/web/index.html` bytes, plus desktop/mobile Chromium order/cancel/reset E2E and screenshots on 2026-11-21. **Release provenance P0 remains:** Vercel's production deployment metadata points to an earlier feature-branch SHA, not the current `main` commit; new direct deployments were blocked by HTTP 402 quota. This is NOT a real exchange. Never send cryptocurrency, keys or KYC documents.

## Website-first P0
The `main` branch contains the static responsive v0.3 paper trading terminal in [`web/index.html`](web/index.html): fabricated BTC/USDC chart/depth, simulated buy/sell limit orders, available/locked demo funds, single/bulk cancellation, safe reset and session history displaying only **OPEN** and **CANCELED**. Reload clears the session. There are no fills, matching, live prices, persistent balances, external API calls or custody. The display is a local educational demonstration.

```bash
node web/site-smoke.test.cjs
node web/site-interaction.test.cjs
```

[Website CI](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml) · [Website deployment gate](docs/SITE_RELEASE.md) · [BDD scenarios](docs/BDD.md) · [PRD](docs/PRD.md) · [100-round progress](docs/PROGRESS.md)

Vercel project `crypto-trading-platform-demo` is linked to GitHub `main`, root `web`, no deployment authentication protection. **Public browser verification exists**, including [release-gate CI with screenshots](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002). The exact `main` → Vercel Production deployment-SHA chain has not been confirmed, so these site rounds are kept Pending.

## Backend development (separate branch)
The [backend feature branch](https://github.com/twappleon/Crypto-Trading-Platform/tree/feat/round-002-postgres-ledger-20261120) and [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1) contain a Java 21/PostgreSQL paper ledger, holds, order reservations, explicit-pair atomic settlement, maker/taker fee logic, and transactional outbox. R002–R008 have **7 Accepted / 100** recorded independent test/CI outcomes. These modules are not merged into the website, and are **not** production funds-safe. The website currently uses only local simulated state.

Round 010 adds Cancel All and guards stale cancellation handlers after reset. Public website is verified at the HTML and browser behavior level; next P0: unblock Vercel production quota and prove that the deployed **production Git SHA equals main HEAD**. After that, integrate persistent sandbox backend with authentication, reconciliation, FIFO replay and safety gates. **No real trading, deposits, withdrawals, wallet keys or customer KYC.**

## Browser QA
```bash
npm install --no-save --no-package-lock playwright@1.64.1
npx playwright install --with-deps chromium
node web/site-browser.test.cjs
SITE_URL=https://crypto-trading-platform-demo.vercel.app/ node web/site-browser.test.cjs
node web/site-public-verify.cjs
```
The real Chromium check covers desktop and 390px mobile, captures screenshots as CI artifacts and verifies simulated balances, Cancel All, stale handlers, reload and no third-party traffic. The [public release workflow](.github/workflows/public-site.yml) verifies HTTPS 200, exact HTML hash, and Chromium interactions/screenshot artifacts separately from local tests; it does not establish Vercel commit provenance.
