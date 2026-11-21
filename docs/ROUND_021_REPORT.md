# Round 021 — linearizable PAPER hold replay vs concurrent cancellation (2026-11-21)

## Status: Submitted / PENDING (not Accepted)
Submitted 21; Accepted 17/100; Failed R001; Pending R016/R020/R021.
Public terminal: https://crypto-trading-platform-demo.vercel.app/ — last confirmed Production source SHA `9516e460` (browser-only v0.9). **No connected PostgreSQL user orders.**

## Independent source changes
- `web/paper-reservations.cjs`: reserve idempotency replay takes the same account row lock as cancel and re-reads state. Reject vanished or unrecognized states. This fixes stale ACTIVE replay observations during concurrent release.
- `web/paper-reservations.test.cjs`: deterministic negative BDD for ACTIVE before lock and RELEASED after lock; verify no duplicate INSERT.
- `qa/paper-reservations.pg.test.cjs`: two actual PostgreSQL 16 clients; uncommitted account-locked cancellation blocks replay until commit; result must be RELEASED with no re-reserve.
- `docs/PRD.md`, `docs/BDD.md`, `docs/PROGRESS.md`: acceptance and security boundaries.

## Gates
Site CI must run Node negative BDD, PostgreSQL 16 concurrency BDD and local Chromium 1366px/390px screenshots; Core BDD must be green. Deployment to existing Vercel Production must show exact new main SHA and publicly accessible HTTPS 200, API negative checks, and **public** browser screenshot artifacts. Any missing gate keeps R021 Pending; never report local screenshots as public site proof.

## Deployment blocker
An explicit attempt to publish main `d7b562ca1a91b65d17a786c62169c9591e7e24e7` returned Vercel HTTP 402 `api-deployments-free-per-day` with 86400-second retry. No payment-plan changes. Existing Vercel Production READY at `9516e460` is not proof of R020 or R021 deployment.

## Safety
PAPER/SANDBOX only. No public write API or token issuer; browser orders/market data are synthetic/volatile. No real-money deposits, withdrawals, private keys, chain trades, real KYC or matching engine.
