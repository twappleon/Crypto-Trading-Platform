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
