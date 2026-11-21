# Round 017 — Manual synthetic PAPER fill (browser-only)
Date: 2026-11-21
Status: Submitted / PENDING production and CI evidence

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
