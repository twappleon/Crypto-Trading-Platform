# Round 020 — isolated durable PAPER reservation / cancel (2026-11-21)

## Result: PENDING; NOT Accepted
Submitted **20**, Accepted **17/100**, Failed **R001**, Pending **R016 and R020**.
[Public demo](https://crypto-trading-platform-demo.vercel.app/) is still the previously verified **v0.9** PAPER/SANDBOX local-only UI, not the new **v1.0** candidate.

## Actual code and tests
[PR #13](https://github.com/twappleon/Crypto-Trading-Platform/pull/13) squash-merged to `main` commit [77ef100863cfb0cf250df6d10866b913adde829f](https://github.com/twappleon/Crypto-Trading-Platform/commit/77ef100863cfb0cf250df6d10866b913adde829f).
- `web/paper-reservations.cjs`: server-only PostgreSQL transactions with account row locking for synthetic holds and owner-scoped cancellation. Only synthetic BTC and USDC, exact fixed-point precision and replay identity checks.
- `web/paper-reservations.test.cjs`: negative BDD on treasury, malformed owner, invalid IDs, zero/exponent/overprecision and reject-before-query.
- `qa/paper-reservations.pg.test.cjs`: real isolated PostgreSQL 16 tests for concurrent oversubscription (two clients, one succeeds), account isolation, idempotency, replay mismatch, cancellation/repeated cancellation, rollback and existing signed balance READ API.
- Public terminal footer candidate v1.0 explicitly labels the durable code as **NOT CONNECTED**; existing browser-only order entry remains volatile. There is **no authenticated public order write API**, trusted token issuer, database credentials on the public site, matching, real funds or keys.

## CI evidence (same merged main SHA)
- [Site + PostgreSQL 16 + local desktop/mobile Chromium run #44875981055](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44875981055): **SUCCESS**, both jobs green.
- [Core BDD run #44875980956](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44875980956): **SUCCESS**.
- [Local Chromium screenshot artifact #14695199043](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44875981055/artifacts/14695199043): desktop and mobile local QA, **not** public v1.0 proof.

## Production and HTTP blocker
- [Public HTTPS gate #44875981015](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44875981015): **FAIL** for v1.0 marker, since public HTTPS 200 served the older v0.9 site. Public v1.0 browser E2E/screenshots did NOT run to completion.
- Latest independently confirmed Vercel Production is [READY dpl_GPCyFca7W1oBZPam33LDLz4tSw5H](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/GPCyFca7W1oBZPam33LDLz4tSw5H), source `main` SHA `9516e460`, **not** R020 `77ef100`.
- An explicit Production deployment of `77ef100` returned **HTTP 402 `api-deployments-free-per-day`, retryAfter 86400**. No billing changes made. CLI fallback is unavailable in the current environment (no Vercel binary, no checked-out source/network).
- Do **not** count R020 as Accepted until `77ef100`-equivalent source has Production READY provenance, public HTTPS/HTML hash, anonymous API negatives, desktop/390px Chromium and public screenshots, alongside green CI.

## Next
Recover automated `GitHub main -> Vercel Production` deployment after free-tier quota, verify true docs-only ignore behavior for R016, then design authenticated PAPER order endpoints against isolated PostgreSQL, durable order journals, FIFO replay and settlement. Continue banning real-money trading, mainnet, private keys, real deposits and real KYC.
