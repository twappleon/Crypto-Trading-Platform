# Round 015 — visible read-only PAPER API status and fail-closed browser diagnosis
Date: 2026-11-21. Branch: feat/round-015-visible-paper-api-status-20261121. **SUBMITTED / PENDING (not Accepted)**.

## Material source changes
- Public terminal v0.8 now offers a user-initiated same-origin read-only GET of `/api/paper-status`; sends no cookie credentials, forbids redirects, requests no-store JSON.
- The only accepted diagnostic is explicitly PAPER_SANDBOX / NOT_READY / BROWSER_MEMORY_ONLY, all persistence/auth/order/live-funds flags false. Malformed/HTML/503/network errors and false READY reports are labeled unavailable or unverified, **never** enabling real trade or durable funds. Sequence ID fences stale responses from rewriting a newer failure.
- New `web/paper-status-ui.test.cjs` verifies exact method/path/options, hostile forged READY/markup, bad content type, failed network and delayed stale success, preserving demo money. CI now runs it with existing site smoke, API negative suite, and Playwright desktop/mobile. Public release gate checks GET=200 and POST=405.

## Accounting and release blockers
**Submitted 15 / Accepted 12 of 100 / Failed R001 / Pending R014 and R015.** This branch is not a deployed, persistent exchange. Final acceptance requires verified source/main Site+Core CI, Vercel Production READY from exact main SHA, public HTTPS 200 + HTML hash, live read-only API GET 200/POST 405 and real desktop/390px mobile Chromium screenshot artifacts. Previous R014 remained blocked by Vercel free daily deployment quota HTTP 402; do not claim live R015 until a new READY record and public tests exist.

## Safety and next work
Synthetic browser session orders remain only OPEN/CANCELED, not filled; reload resets all. No deposits, withdrawals, KYC, wallet keys, live quotes or real money. Next: clear release proof, then build authenticated/account-isolated durable PostgreSQL PAPER API with reconciliation/replay and fail-closed E2E.

## Final R015 Accepted evidence — 2026-11-21
**R015 Accepted once. Submitted 15 / Accepted 14/100 / Failed R001 / Pending 0.** The initial PR Site CI failure was an incorrect VM stub expectation about initial HTML text, corrected by [test commit 2aa4cbb](https://github.com/twappleon/Crypto-Trading-Platform/commit/2aa4cbb72885ff44cca5539db8d98b7c341c0de6); final CI is green. Public site has observable API diagnostic and fail-closed forged READY/503/network handling. This does NOT mean server-side PAPER orders or funds exist.

- R015 source: [PR #7](https://github.com/twappleon/Crypto-Trading-Platform/pull/7); released main SHA [15844ec](https://github.com/twappleon/Crypto-Trading-Platform/commit/15844ec0b42c023a90fce6b2972418d041c836e2).
- R015 PR [Site CI SUCCESS #44850667770](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850667770), [Core CI SUCCESS #44850667764](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850667764); final main [Site CI SUCCESS #44850768080](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850768080), [Core CI SUCCESS #44850768167](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850768167).
- [Vercel Production READY dpl_5kGH5APwhQec7hNPjzneF8zM9min](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/5kGH5APwhQec7hNPjzneF8zM9min): target production, GitHub ref main, commit SHA 15844ec0b42c023a90fce6b2972418d041c836e2, public alias https://crypto-trading-platform-demo.vercel.app/.
- [Public release E2E SUCCESS #44850768106 attempt 2](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850768106/attempts/2): anonymous HTTPS 200; byte-for-byte source/public SHA256 27d41cfa7c9a56a92779e545e031a688c0cfca6cf71514b7f23630c4fd84cf86; GET /api/paper-status 200 NOT_READY, POST 405; desktop 1366px and mobile 390px Chromium, negative unavailable API, local buy/sell/cancel/reset/history. [Screenshot artifact #14684204570](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44850768106/artifacts/14684204570).
- The first public E2E attempt failed while the Vercel alias was still older; rerun after READY succeeded. The feature remains browser-only synthetic data; no authenticated or persistent API, real money, private keys, KYC or on-chain execution.

