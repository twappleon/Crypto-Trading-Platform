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

## Round 010 website-first safety extension
The P0 paper terminal must support single cancellation and atomic-in-browser cancel-all of synthetic holds with truthful OPEN/CANCELED session history. Buttons detached before a reset cannot cancel new orders: never recycle browser-lifetime order IDs while listeners can survive. This client-side simulator remains transient, does not persist, fill, or send real market orders. Until a public Vercel HTTPS URL has been authenticated-logout tested on desktop and mobile against the exact SHA and CI is green, the site milestone is pending and not part of the Accepted counter.

## Round 011 — integer-safe synthetic order reservation
Website-first safety requirement: BUY quote collateral must be calculated as **ceil(priceCents × quantityMicroBTC ÷ 1,000,000)** USDC cents with exact BigInt arithmetic; SELL collateral is an exact integer count of 0.000001-BTC units. Price input has at most 2 decimals and quantity at most 6. Reject exponent/negative/overprecision values, overflows beyond bounded allowed price/quantity, and any order whose rounded-up hold exceeds currently available synthetic cents or micro-BTC. Canceled and canceled-all holds must release without duplicate mutation. Display the conservative reserve. The local demo has no executions, durable storage, or external APIs. Deployment acceptance additionally requires Vercel production branch=main, exact SHA, public HTTPS 200, desktop/mobile browser tests, and green CI.

## Round 012 — front-end PAPER reserve preview (P0)
The local terminal must show the user, before submitting an order, the exact amount of synthetic quote (BUY) or base (SELL) locked, plus the corresponding currently available balance and insufficient-funds status. Compute previews from the same checked BigInt inputs and reserve-ceiling rule used by submission, never floating-point heuristics. Recalculate after a valid reserve, side switch, cancel, Cancel All and Reset; reject invalid/overprecision/exponent input from the preview. Never advertise this as a real quote, fill, balance, persistence, or wallet. Desktop/390px Chromium and isolated DOM BDD must verify these transitions, with GitHub CI and a Vercel READY Production record for the exact `main` SHA before Accepted.
