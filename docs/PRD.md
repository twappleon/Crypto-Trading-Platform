# Crypto Trading Platform MVP — PRD v0.1
Scope: secure auth + 2FA, third-party sandbox KYC, paper wallet journal, limit/market spot trading, price-time matching, WebSocket data, admin RBAC, audit, fees and monitoring.
Stack: Java 21/Spring Boot, PostgreSQL, Redis, Next.js. One deterministic sequencer per market pair. Double-entry postings atomically coupled to reservations and settlement.
Milestone 1: architecture + executable paper-only domain prototype.
Milestone 2: auth, MFA, KYC sandbox and admin.
Milestone 3: PostgreSQL durable double-entry ledger and holds.
Milestone 4: engine, trading API and market data.
Milestone 5: security, load tests, E2E and deployment.
P0 gates: per-asset conservation, precision, duplicate request conflict, durable audit and reconciliation, crash-safe replay, no negative user balances, no access across roles, no live funds until independent compliance/security assessment.
Out of scope for MVP: real asset custody, on-chain withdrawals, live capital and regulated exchange launch.


## P0 visibility and deployment — update 2026-11-21
The user's primary acceptance requirement is an actual public, usable **paper-only** main site, not a hidden backend-only progress ledger.
- Production source: `main:web/` served by Vercel project `crypto-trading-platform-demo`, with GitHub `main` connected to production. No real wallet/address/API keys or live market orders in client code.
- Public access must be tested by a client **without** a Vercel team login. User-visible HTTPS, mobile RWD, synthetic quote/depth, limit buy/sell reserve/cancel, available/locked balances, explicit "no executions", and session history are P0.
- All market prices/order-book rows are fabricated. Browser session holds are local non-durable simulation, with only OPEN/CANCELED statuses. No fills, fee transfers, matching, server persistence, customer accounts, or investment functions are implied.
- Require actual browser interaction BDD (`web/site-interaction.test.cjs`) in addition to static smoke. CI and public URL must be validated on the **same deployed SHA** before Accepted.
- Vercel quota, authentication protection, blocked access, missing domain, unavailable project, or broken interactive controls are **release blockers**; code pushed alone never counts as site Accepted.
- PostgreSQL ledger/backend code currently resides on branch `feat/round-002-postgres-ledger-20261120` (7 Accepted/100 as of Round 008). Do not claim it serves web users or merge it blindly into the static site.
