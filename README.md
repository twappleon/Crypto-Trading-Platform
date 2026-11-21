# Crypto Trading Platform — PAPER / SANDBOX

> **PUBLIC PAPER/SANDBOX DEMO v0.6 IS LIVE:** [Open the browser-only site](https://crypto-trading-platform-demo.vercel.app/). Vercel Production [dpl_D8gz7J2s](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/D8gz7J2sRtXf6UjXKqumLzqVMLNv) was READY on GitHub `main` SHA [`ed8478b`](https://github.com/twappleon/Crypto-Trading-Platform/commit/ed8478b90655a14bbf6b783828073b73cf271afa); [public HTTPS/source hash + desktop/mobile Chromium release gate attempt 2](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44828632196/attempts/2) SUCCEEDED with screenshots. The site is a disposable local simulation, NOT a real exchange. Never send funds, keys or personal KYC records.

## Website-first P0
The `main` branch contains the static responsive v0.6 paper trading terminal in [`web/index.html`](web/index.html): fabricated BTC/USDC chart/depth, simulated buy/sell limit orders, available/locked demo funds, single/bulk cancellation, safe reset and session history displaying only **OPEN** and **CANCELED**. Reload clears the session. There are no fills, matching, live prices, persistent balances, external API calls or custody. The display is a local educational demonstration.

```bash
node web/site-smoke.test.cjs
node web/site-interaction.test.cjs
```

[Website CI](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml) · [Website deployment gate](docs/SITE_RELEASE.md) · [BDD scenarios](docs/BDD.md) · [PRD](docs/PRD.md) · [100-round progress](docs/PROGRESS.md)

Vercel project `crypto-trading-platform-demo` is linked to GitHub `main`, root `web`, no deployment authentication protection. **Public browser verification exists**, including [release-gate CI with screenshots](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002). The v0.5 site at released source `ed8478b` has Vercel Production READY and public browser/CI proof. R009–R012 pending site gates were closed only after that verification (11 Accepted / 100 overall, R001 still failed).

## Backend development (separate branch)
The [backend feature branch](https://github.com/twappleon/Crypto-Trading-Platform/tree/feat/round-002-postgres-ledger-20261120) and [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1) contain a Java 21/PostgreSQL paper ledger, holds, order reservations, explicit-pair atomic settlement, maker/taker fee logic, and transactional outbox. R002–R008 have **7 Accepted / 100** recorded independent test/CI outcomes. These modules are not merged into the website, and are **not** production funds-safe. The website currently uses only local simulated state.

Round 010 adds Cancel All and guards stale cancellation handlers after reset. Public website is verified at the HTML and browser behavior level; v0.5 public release passed SHA/HTTPS/browser acceptance on source `ed8478b`. Next P0 is integrating a **separately authenticated, persistent PAPER-only backend** with safe reconciliation/FIFO replay; do not imply the current local session orders persist. **No real trading, deposits, withdrawals, wallet keys or customer KYC.**

## Browser QA
```bash
npm install --no-save --no-package-lock playwright@1.64.1
npx playwright install --with-deps chromium
node web/site-browser.test.cjs
SITE_URL=https://crypto-trading-platform-demo.vercel.app/ node web/site-browser.test.cjs
node web/site-public-verify.cjs
```
The real Chromium check covers desktop and 390px mobile, captures screenshots as CI artifacts and verifies simulated balances, Cancel All, stale handlers, reload and no third-party traffic. The [public release workflow](.github/workflows/public-site.yml) verifies HTTPS 200, exact HTML hash, and Chromium interactions/screenshot artifacts separately from local tests; it does not establish Vercel commit provenance.

## Round 011 — exact paper reserve precision
The v0.4 local-only trading form stores BUY holds as integer USDC cents and SELL holds as integer 0.000001-BTC units. Price and quantity input are parsed into BigInt scaled units (not binary floats); BUY reservations always ceil to whole cents, including micro-size orders. The screenshot/real-browser BDD checks that 64275.01 × 0.000001 BTC holds **0.07 demo USDC**, and that a fully locked demo wallet cannot accept a sub-cent extra BUY. This is only synthetic collateral arithmetic, not a real exchange settlement system. See [Round 011 report](docs/ROUND_011_REPORT.md).

## Round 012 — pre-submit local reserve transparency
The v0.5 paper trading form now previews **exact** integer-scaled collateral and currently available synthetic funds for the selected BUY/SELL side before submission. It updates on input, side switch, submit, individual cancel, Cancel All and Reset. Unaffordable attempts show a visible insufficiency warning before submit; invalid/overprecision/exponent fields are not quoted. A large, rejected request is formatted without IEEE-754 loss. This preview is **browser-only**, not an exchange price quote or real deposit guarantee. Site/Chromium negative BDD and production SHA/HTTPS gates still apply. [Round 012](docs/ROUND_012_REPORT.md).

## Round 013 — browser-only order-history export (released v0.6)
The next website update adds a local JSON export of synthetic OPEN/CANCELED session records with exact integer price/quantity units. It is useful for filing reproducible demo QA reports, but is **not** a PostgreSQL transaction history and is cleared from the browser on reset/reload. No network call or persistent storage is introduced. Version v0.6 is publicly released: [Vercel Production READY](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/7vYoVirpEotijvkVhdBZRA9eTS2L) at `main` SHA `0c1578f7`, with [unauthenticated HTTPS/hash and desktop/mobile Chromium E2E SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837166478). No server-side persistence or real orders are involved.

**Round 013 acceptance:** [PR #5](https://github.com/twappleon/Crypto-Trading-Platform/pull/5), [source+browser BDD](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44836991383), [exact main deployed commit](https://github.com/twappleon/Crypto-Trading-Platform/commit/0c1578f7a2a6e538b5f85a2b61a00b06d129a011), [public release gate](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837166478) and [screenshots](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837166478/artifacts/14678557644). Submitted 13; Accepted 12/100; R001 failed. `main` docs may advance independently of the feature source SHA.

## Round 014 — paper API readiness boundary (v0.7 candidate)
Website displays **BROWSER MEMORY ONLY** and links to read-only `/api/paper-status`. Fixed GET/HEAD JSON returns `readiness=NOT_READY`, `durablePostgresConnected=false`, and `orderEntryEnabled=false`. Write methods 405; no orders, funds, private keys, identities or KYC are accepted, and no page state is sent to the endpoint. A functioning status endpoint is NOT PostgreSQL persistence or auth. R014 is pending GitHub CI and an exact-main Vercel Production/HTTPS/desktop+mobile browser release gate. [R014 report](docs/ROUND_014_REPORT.md).


## Round 015 — visible fail-closed PAPER API diagnostics (submitted 2026-11-21)
The browser terminal v0.8 adds an explicit user-triggered same-origin, credential-free **GET** to \`/api/paper-status\` to diagnose rollout of the read-only Vercel function. It never enables server-side orders or persists balances. It treats a missing endpoint, invalid content-type, unexpected READY/capabilities, failed response, and out-of-order stale status as **unverified**. New hostile-response VM BDD, desktop/mobile Chromium, and public API GET 200/POST 405 release assertions are mandatory. Until exact-main Vercel Production + public Chromium + green CI, **R015 is Pending**. R014 also remains Pending. No real funds, private keys or real KYC.
## Latest verified release — Atlas Exchange v0.8 (2026-11-21)
The old v0.6 banner above is historical. The [public paper-only site](https://crypto-trading-platform-demo.vercel.app/) is now v0.8 from [main feature SHA 15844ec](https://github.com/twappleon/Crypto-Trading-Platform/commit/15844ec0b42c023a90fce6b2972418d041c836e2), with [Vercel READY](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/5kGH5APwhQec7hNPjzneF8zM9min) and [HTTPS/browser API/E2E success](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850768106/attempts/2). R014/R015 have separate source/BDD and are now Accepted; Submitted 15 / Accepted 14/100 / Failed R001 / Pending 0. Diagnostic reads NOT_READY; all demo orders/funds are still browser-memory-only. Next: authenticated durable PostgreSQL PAPER API.

## R016 — preserve public site deployment quota (submitted)
`web/deployment-gate.cjs` is a Vercel **Ignored Build Step** candidate (`node deployment-gate.cjs` from project root `web/`). It skips a proven documentation-only commit, builds when anything under `web/` changes, and fails open to build on missing Git history or suspicious metadata. Negative BDD: `node web/deployment-gate.test.cjs`. A Vercel project setting change is needed and must be verified separately. All website state remains synthetic browser memory, **not PostgreSQL**.
