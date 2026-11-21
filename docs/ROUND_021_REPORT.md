# Round 021 — linearizable PAPER hold replay vs concurrent cancellation (2026-11-21)

## Status: ACCEPTED after exact Production/CI/public Chromium gates
Submitted 21; Accepted 19/100; Failed R001; Pending R016 only. R020 and R021 closed at the same exact-source public v1.0 release.
Public terminal: https://crypto-trading-platform-demo.vercel.app/ — new confirmed Production source SHA `1b632fb` (browser-only v1.0). **No connected PostgreSQL user orders.**

## Independent source changes
- `web/paper-reservations.cjs`: reserve idempotency replay takes the same account row lock as cancel and re-reads state. Reject vanished or unrecognized states. This fixes stale ACTIVE replay observations during concurrent release.
- `web/paper-reservations.test.cjs`: deterministic negative BDD for ACTIVE before lock and RELEASED after lock; verify no duplicate INSERT.
- `qa/paper-reservations.pg.test.cjs`: two actual PostgreSQL 16 clients; uncommitted account-locked cancellation blocks replay until commit; result must be RELEASED with no re-reserve.
- `docs/PRD.md`, `docs/BDD.md`, `docs/PROGRESS.md`: acceptance and security boundaries.

## Gates
Site CI must run Node negative BDD, PostgreSQL 16 concurrency BDD and local Chromium 1366px/390px screenshots; Core BDD must be green. Deployment to existing Vercel Production must show exact new main SHA and publicly accessible HTTPS 200, API negative checks, and **public** browser screenshot artifacts. Any missing gate keeps R021 Pending; never report local screenshots as public site proof.

## Deployment blocker
An earlier explicit manual deployment attempt of prior main `d7b562ca1a91b65d17a786c62169c9591e7e24e7` returned Vercel HTTP 402 `api-deployments-free-per-day` with 86400-second retry. No payment-plan changes. Later GitHub-main auto-deploy `1b632fb` reached READY with public v1.0 gate; the prior `9516e460` was only old v0.9 proof.

## Safety
PAPER/SANDBOX only. No public write API or token issuer; browser orders/market data are synthetic/volatile. No real-money deposits, withdrawals, private keys, chain trades, real KYC or matching engine.

## Final independent evidence (2026-11-21)
- [Merged PR #14](https://github.com/twappleon/Crypto-Trading-Platform/pull/14), [feature-bearing main SHA `1b632fb`](https://github.com/twappleon/Crypto-Trading-Platform/commit/1b632fb6969e6d9f367cc15b9c54c7050ae7a98a).
- [Main Site + PostgreSQL 16 + local desktop/mobile Chromium CI SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44880173449); [Main Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44880173495).
- [Vercel Production READY for exact main SHA](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/3CrbA5Ee1JC1upnChoZAN4bM6aDo), public alias attached.
- [Public site HTTPS 200 / exact v1.0 HTML hash / API GET and forbidden POST / Chromium desktop+390px E2E SUCCESS attempt 2](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44880173448/attempts/2); [PUBLIC screenshot artifact #14696699383](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44880173448/artifacts/14696699383). Attempt 1 failed on old alias before Vercel propagation and was **not** used for acceptance.
- R020 Accepted retroactively based on the same verified current production source, separate CI and feature history; R021 Accepted once. Accepted total **19/100**, Pending **R016**. Public site remains BROWSER MEMORY ONLY; no real-money or server-backed public order entry.
