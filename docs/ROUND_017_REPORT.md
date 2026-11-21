# Round 017 — Manual synthetic PAPER fill (browser-only)
Date: 2026-11-21
Status: Submitted; feature-branch CI PASSED; Production PENDING

## Independent source
- `web/index.html`: manual Simulate fill for open local BUY and SELL orders, integer-cent/microBTC quantity settlement; history SIMULATED_FILLED; local JSON export separately counts simulatedFills while real executions remain zero. No matching, external orders, customer accounts or PostgreSQL.
- `web/site-interaction.test.cjs`: BUY and SELL synthetic balance transitions, stale/double-fill, canceled-fill rejection, export and reset negative BDD.
- `web/site-browser.test.cjs`: same real desktop and 390px mobile Chromium checks with screenshots.
- `web/site-smoke.test.cjs`, `web/site-public-verify.cjs`: keep explicit simulator safety disclosure and exact v0.9 release fail-closed markers.
- README, PRD, BDD and PROGRESS updated.

## Non-negotiable acceptance gates
- [ ] New source and negative tests pass GitHub Actions on feature SHA and merged main SHA.
- [ ] Production Vercel READY originated from exact feature-containing GitHub main SHA, and GitHub main -> Production chain is working.
- [ ] Public anonymous HTTPS 200, exact v0.9 HTML SHA-256, diagnostic GET 200 NOT_READY / POST 405.
- [ ] Desktop 1366 / mobile 390 Chromium E2E passes on the public URL with downloadable screenshots.
- [ ] R016 separately validated and counted only if its configuration behavior is confirmed.

If any check fails, R017 remains Submitted/Pending. Never add another Accepted to 14/100 without independent evidence. Existing public v0.8 continues to be purely browser-memory-only. R018 should prioritize authenticated, tenant/account-scoped PostgreSQL PAPER API over more toy features.

## Safety
All data fabricated. Manual "Simulate fill" is NOT real execution, matching or financial settlement. No live pricing, funds, KYC records, keys, custody or blockchain activity.

## GitHub merge, CI and Production disposition — 2026-11-21
- [PR #9](https://github.com/twappleon/Crypto-Trading-Platform/pull/9) merged to main at [bc63bff0a3126472943e3378a9ab95ba419af433](https://github.com/twappleon/Crypto-Trading-Platform/commit/bc63bff0a3126472943e3378a9ab95ba419af433).
- Feature SHA `e4a8760683eb685b2a647440ce63dfe90720ed02` [GitHub Site/Chromium run #44861051909 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44861051909), [Core BDD #44861051917 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44861051917). Main-merge SHA workflow result not independently confirmed in this execution.
- Attempted production POST with project `prj_JESXfEsbUcjI6dA6Yoe3VfcV8iPf`, GitHub `main`, exact source `bc63bff`; Vercel returned **HTTP 402** `api-deployments-free-per-day`, `retryAfter=86400`. No change to billing/plan. Vercel CLI not installed in this environment; no authorized credentialed fallback.
- Last confirmed Production READY still [dpl_BFawDRtmb6EDnuaDp4Biu4ZVBN2x](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/BFawDRtmb6EDnuaDp4Biu4ZVBN2x) (`main` SHA `e617f686`, public v0.8). **v0.9 not independently published, live HTTP/browser checks of v0.9 not run.**
- **R017 status PENDING; Accepted stays 14/100; Submitted 17; Failed R001; R016 also Pending.** Release proof checklist above remains unchecked for Vercel READY and public site. Site functionality is still nonpersistent/unauthenticated; paper synthetic fills do not indicate real trades.
