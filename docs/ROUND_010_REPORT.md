# Round 010 — Main-site v0.3 paper terminal (2026-11-21)
**Submitted, not yet Accepted:** cumulative **7/100 Accepted**, 10 submitted. Live website works, but strict production Git SHA provenance is not yet verified.

## Meaningful source changes merged
[PR #2](https://github.com/twappleon/Crypto-Trading-Platform/pull/2) was squash merged into `main`: [9c289fc](https://github.com/twappleon/Crypto-Trading-Platform/commit/9c289fc67059ed5dfe5c8766899e69eee8caa251).
- `web/index.html` v0.3: "Cancel all open demo orders" safely releases BUY/SELL synthetic holdings, retains truthful CANCELED session history, repeat no-op. `seq` remains monotonic across Reset to prevent a retained stale cancel DOM handler from canceling a newly created order.
- `web/site-interaction.test.cjs` and `web/site-smoke.test.cjs` test safe reserve/cancel/history/reset, invalid precision/overdraft, stale detached handler, no network persistence.
- `src/main/java/exchange/ExchangeCore.java`: fix inherited R001 `Map.of.containsValue(null)` NPE; `src/test/java/exchange/ExchangeCoreBDD.java`: reject null entries without account mutation or runtime NPE.
- `web/site-browser.test.cjs`: real Chromium 1366×768 desktop and 390×844 mobile checks including logged-out HTTP response, paper labeling, BUY+SELL synthetic reserve, overdraft, stale cancel, Cancel All, reset/reload, cross-origin requests, horizontal overflow and screenshots.
- `.github/workflows/site.yml` runs Node VM and Chromium screenshot E2E using Playwright 1.64.1 (updated from 1.56.0 after GitHub Ubuntu 26.04 install failure).
- `web/site-public-verify.cjs` and `.github/workflows/public-site.yml` validate real public HTTPS, byte-for-byte HTML SHA256 match to `main/web/index.html`, desktop/mobile Chromium E2E and screenshot artifacts.

## Actual CI and public browser evidence
- [Main Site Smoke / local Chromium SUCCESS #44811844796](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811844796) on merge SHA `9c289fc`.
- [Main Core JDK BDD SUCCESS #44811844962](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811844962), same merge SHA.
- [**Public HTTPS + desktop/mobile Chromium SUCCESS #44812029002**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002) on `main` source `e62289047526bca5218a57a63fabd7070d029490`. The GitHub runner performed an unauthenticated HTTPS GET to **https://crypto-trading-platform-demo.vercel.app/** and asserted HTTP 200 and the exact same SHA256 HTML bytes as checked-out `main/web/index.html`.
- Public browser E2E against that real URL passed desktop and mobile checks, with [artifact `paper-site-public-desktop-mobile` on Run #44812029002](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002), artifact ID 14666238069, 381645 bytes. These are actual browser screenshots, not a mocked image.
- Static UI remains synthetic local browser memory. There is NO connected live exchange, real price feed, trade execution, KYC, persistence, custody, deposits or withdrawals.

## Remaining blocking gate
Vercel project `crypto-trading-platform-demo` has a production READY deployment (`dpl_74a8XCKZFpQgzA1GkWM5oiERd3d3`), but its Git metadata is feature branch `feat/round-010-site-order-safety-20261121` at `a70b3f4c640698141e073b1b3801c9929ffbf013`, not the exact current GitHub `main` SHA. This deployment contains the **identical HTML bytes** to main; the public website and browser checks are real, but deployment revision provenance remains unverified. A new explicit Vercel Production deployment API attempt returned **HTTP 402** `api-deployments-free-per-day`, `retryAfter=86400`; no local authorized Vercel CLI fallback.

**Decision:** R010 remains PENDING/NOT Accepted under the exact-SHA requirement. R009 also remains pending; 7/100 Accepted stays unchanged. Next release gate: deploy the then-current `main` SHA to Vercel Production when allowed, verify `READY`, `target=production`, matching `githubCommitSha`, then rerun public CI. Do not award 1 or 2 rounds just for a public site on an older feature SHA.

## Links
[Live paper-only demo](https://crypto-trading-platform-demo.vercel.app/) · [GitHub PR #2](https://github.com/twappleon/Crypto-Trading-Platform/pull/2) · [Public HTTPS Browser E2E](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44812029002) · [Current progress](PROGRESS.md) · [Deployment safety](SITE_RELEASE.md)
