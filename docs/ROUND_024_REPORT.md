# Round 024 — opt-in synthetic PostgreSQL PAPER reservation (2026-11-21)

## Original pre-release checkpoint (superseded by final acceptance)
Submitted 24; Accepted 21/100; Failed R001; Pending R023/R024. Program changes and isolated tests alone do not satisfy production/browser acceptance.

## Implementation
- POST /api/paper-reserve: default-disabled using PAPER_RESERVATIONS_WRITE_ENABLED=sandbox-only, minimum 32-character HMAC secret and PostgreSQL DSN.
- Server-to-server HMAC scope paper:reservations:write with short expiry, paper_ synthetic-only subject and no owner override; strictly parse JSON id, USDC/BTC and decimal-string amount.
- Browser Origin and credential cookies cannot authenticate. No CORS, no token issuer. Unconfigured POST 503; GET 405; malformed data 400; permission 401/403; insufficient/conflict 409; DB fault 503 without leakage.
- Underlying real PostgreSQL 16 reserve uses existing account row locks and transaction-level idempotency. New first committed hold responds 201; replay 200; canceled replay never resurrects released funds.
- New negative unit BDD, isolated PostgreSQL integration, public anonymous denial test and Site/Public workflows.
- The public v1.0 UI remains BROWSER MEMORY ONLY: no true customer accounts, persistent browser orders, real trading, chain transfers, real funds, KYC or private keys.

## Independent gates — not assumed
- PR and main GitHub Site+PG CI: pending observation
- PR and main Core BDD: pending observation
- Exact main SHA Vercel Production READY: pending
- Public HTTPS GET 405, unsigned POST 401/503: pending
- Public desktop+390px Chromium and screenshot artifacts: pending
- R023 exact source release: also pending

Production demo: https://crypto-trading-platform-demo.vercel.app/
Progress: https://github.com/twappleon/Crypto-Trading-Platform/blob/main/docs/PROGRESS.md


## Final acceptance — 2026-11-21
R024 is **ACCEPTED** after [PR #17 merged](https://github.com/twappleon/Crypto-Trading-Platform/pull/17) into [main 6a3b488d](https://github.com/twappleon/Crypto-Trading-Platform/commit/6a3b488d18944c30171940f9895e94d3435a3c6c), [branch Site/real PG16/local Chromium SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894356616), [branch Core SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894356608), [main Site+PG16+desktop/mobile Chromium SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894499364), [main Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894499263), [Vercel GitHub main automatic Production READY exact SHA](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/3dzWoXSydWa246UNnmtWL3kgrMW3), and [public HTTPS/anonymous write denial/real desktop-mobile Chromium E2E run #44894499351 attempt 2 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894499351/attempts/2) with [public screenshot artifact 14703248148](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44894499351/artifacts/14703248148). Attempt 1 failed while the public alias still pointed at the previous deployment and was not counted. Public PAPER API remains disabled/unconfigured 503; GET is 405; no browser persistent orders, funds or actual trades.

Combined totals: **Submitted 24 · Accepted 23/100 · Failed R001 · Pending 0**. R023 retroactively accepted independently; no extra round awarded for docs.
