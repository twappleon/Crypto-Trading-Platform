# Public PAPER/SANDBOX site release — evidence ledger

## Current independently verified state — 2026-11-21
**Public working demo URL:** https://crypto-trading-platform-demo.vercel.app/

- [GitHub Actions Public Release Gate SUCCESS #44812029002](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002), source commit [e622890](https://github.com/twappleon/Crypto-Trading-Platform/commit/e62289047526bca5218a57a63fabd7070d029490) on `main`, independently fetched public site via unauthenticated HTTPS and asserted **HTTP 200**.
- The public response HTML's SHA-256 was asserted byte-for-byte identical to the checked-out `main/web/index.html`; all safety/feature markers were present (`PAPER / SANDBOX`, `Synthetic market data`, `Cancel all open demo orders`, `Prototype v0.3`, `no executions`).
- Same release job ran real headless Chromium against the **public HTTPS URL** for desktop 1366×768 and mobile 390×844. Both workflows passed order placement, synthetic holds, overdraft rejection, detached stale cancel, SELL, Cancel All, repeat no-op, reload clearing, no cross-origin traffic and mobile width. [Public desktop + mobile screenshot artifact](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002) (`paper-site-public-desktop-mobile`, artifact ID 14666238069).
- [Main site CI SUCCESS #44811844796](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811844796) and [Core BDD SUCCESS #44811844962](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811844962), squash merge [9c289fc](https://github.com/twappleon/Crypto-Trading-Platform/commit/9c289fc67059ed5dfe5c8766899e69eee8caa251), [PR #2 merged](https://github.com/twappleon/Crypto-Trading-Platform/pull/2). The Java main-branch NPE from original R001 was repaired with a regression test.

## Remaining P0 release-provenance blocker
Despite the public URL and actual browser tests passing, **do not yet mark Round 009 or 010 as Accepted** under strict deployment-SHA rules.

- Vercel project: `crypto-trading-platform-demo`, ID `prj_JESXfEsbUcjI6dA6Yoe3VfcV8iPf`, repository `twappleon/Crypto-Trading-Platform`, root `web`, authentication protection disabled.
- Vercel lists READY deployments and the production alias, but the recorded production deployment `dpl_74a8XCKZFpQgzA1GkWM5oiERd3d3` has metadata `githubCommitRef=feat/round-010-site-order-safety-20261121`, `githubCommitSha=a70b3f4c640698141e073b1b3801c9929ffbf013`, **not the exact current `main` SHA**. The public HTML currently matches main byte-for-byte because the HTML has not changed since that feature commit, but commit provenance is not established by matching bytes alone.
- The explicit Vercel POST Production deployment request returned HTTP **402** `api-deployments-free-per-day` with `retryAfter=86400`. No authenticated Vercel CLI fallback was available. This is a quota issue, not a reason to expose a falsely described live exchange.
- Latest `main` commits contain release scripts, workflows and docs; no latest-`main` Production deployment with a matching `githubCommitSha` has been verified.

## Next required acceptance step
1. When Vercel quota permits, deploy the then-current `main` to **Production**, ensure `target=production`, `READY`, and `githubCommitSha == main HEAD`; ensure the production alias remains attached.
2. Re-run `node web/site-public-verify.cjs` and `SITE_URL=https://crypto-trading-platform-demo.vercel.app/ node web/site-browser.test.cjs` from exact main SHA; ensure GitHub Actions `Public PAPER Site Release Gate` SUCCESS and preserve desktop/mobile screenshot artifact.
3. Update `docs/PROGRESS.md` with deployment ID, SHA, HTTP/browser evidence and one explicit acceptance decision. Do not double-count work or retroactively award failed Round 001.
4. Next feature priority: integrate the existing PostgreSQL paper-only backend (currently separate Draft PR #1) with authenticated API and RWD terminal, then FIFO/crash replay and real browser E2E; do not mislabel synthetic session balances as persisted.

## User safety
Educational, locally simulated order intentions only, not a regulated exchange. Quotes, chart, depth and balances are fabricated. No real execution, order matching, deposits, withdrawals, wallets, private keys, external market API calls, real user KYC or persistent funds. Orders are only OPEN/CANCELED; reload loses session.

## Round 011 production redeploy checkpoint (2026-11-21)
The earlier 402 quota blocker cleared for new READY Production deployment [dpl_4ymvDQTGJyPiBc2X698SDWwCFZZ6](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/4ymvDQTGJyPiBc2X698SDWwCFZZ6): githubCommitRef=main, githubCommitSha=77b061928b7731cd08eda9dbfc6fe0f5b18cd453, target=production, alias crypto-trading-platform-demo.vercel.app. This resolves old feature-branch provenance for v0.3. Earlier 402 entries are historical, not current blocker evidence.
R011 v0.4 introduces exact synthetic quote reserves. Do NOT count accepted or claim public v0.4 until its main SHA has green GitHub CI, READY Vercel production metadata matching the SHA, public HTTPS byte-for-byte source match, and desktop/mobile Chromium browser evidence.

## R011 post-merge release attempt — blocked
R011 merged to main as [a9b5eab](https://github.com/twappleon/Crypto-Trading-Platform/commit/a9b5eab4db5a14f11833b5a14dfdb137b8eac2fa) after PR [Site Smoke SUCCESS #44820788414](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44820788414) and [Core BDD SUCCESS #44820788884](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44820788884). Explicit Vercel Production deployment (target=production, ref=main, exact SHA=a9b5eab) was rejected HTTP 402 `api-deployments-free-per-day` retryAfter 86400. Prior v0.3 release 77b0619 remains READY on the public alias. No claim v0.4 is live. R011 pending, Accepted 7/100. The workflow's public HTML/hash gate should fail closed until the public URL updates to the R011 SHA. Do not upgrade plans or enable payment automatically.
