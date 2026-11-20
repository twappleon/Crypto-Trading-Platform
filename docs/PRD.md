# Crypto Trading Platform MVP — PRD v0.2

## Purpose and safety boundary
Demo a modular spot exchange MVP in 100 evidence-backed development rounds. PAPER funds only; no real trades, live capital, private-key storage, on-chain deposits/withdrawals or public financial operation. Licenses, custody, KYC contracts, third-party audit and incident response remain independent launch gates.

## Modules and acceptance ordering
1. P0: matching correctness; durable PostgreSQL double-entry ledger; user available/held balances; atomic reserve/fill/release; idem keys and concurrent settlement; crash replay and reconciliation; invariant-based BDD.
2. P1: Spring Boot secure REST and WebSocket, authentication/MFA, KYC sandbox adapter, market data, fees, admin RBAC and full audit.
3. P2: Next.js paper trading front end, container deployment, load testing, abuse and end-to-end browser/security verification.

## Ledger design (Round 002)
- Accounts keyed by (asset, account ID), numeric(38,18); treasury is a synthetic negative-balance paper funding account.
- Journals have globally unique IDs and deterministic SHA-256 canonical request fingerprints.
- Journal insert, account row locks, debits/credits and entries commit or rollback atomically in PostgreSQL.
- A repeated ID with the same normalized amounts is a no-op; a repeated ID with different intent is a conflict.
- Reject unsafe account/asset IDs, zero-value entries, unbalanced journals, precision overflow and overdrafts.
- SQL check constraints prevent negative user balances, foreign keys protect account/journal references.
- All account rows locked in canonical sort order to avoid write-skew/most deadlocks.
- Integration CI: PostgreSQL 16 service; JUnit tests for replay/idempotency, conservation, overdraft and concurrent debits.

## Known P0 limitations
- Journal application is still separate from exchange order matching: no holds/reservations or fill settlement.
- No tamper-proof append-only DB enforcement, database-side sum=0 trigger, privileges, production migration governance, reconciliation task, retry policy or ledger rebuild/snapshot.
- Round 002 is a paper-only proof, not evidence of production security.
- Launch requires security review and legal/compliance sign-off.
