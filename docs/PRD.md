# Crypto Trading Platform MVP — PRD v0.3

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

## Round 003 conservation and retry hardening
- Additive V2 schema installs deferred PostgreSQL constraint triggers: commits reject newly inserted journals without at least two entries summing to zero. Entries and journal records reject SQL UPDATE/DELETE.
- Read-only `verifyConservation()` detects per-account derived-balance drift and incomplete/unbalanced journals. It is a diagnostic operation, never auto-repairs financial data.
- `postWithRetry(id, asset, entries, maxAttempts)` retries only SQLSTATE 40001 (serialization) and 40P01 (deadlock), bounded to 1–5 attempts using the exact same journal ID. Ambiguous commit failure (08006), constraint errors and overdrafts fail closed.
- V2 disposable migration uses explicit `-- @statement` boundaries to keep PL/pgSQL semicolons within SQL function bodies; production requires a versioned migration tool and least-privilege DB roles.
- Negative BDD includes direct SQL unbalanced insert rollback at COMMIT, forbidden rewrites/deletes, simulated transient SQLSTATE retry and uncertain-commit fail-closed behavior, and deliberate privileged balance drift detected/restored.

## Known P0 limitations
- Journal application is still separate from exchange order matching: no holds/reservations or fill settlement.
- Database triggers defend ordinary writes but are not tamper-proof against database owners/superusers. No least-privilege DB roles, production migration governance, scheduled reconciliation/alerting, ledger rebuild/snapshot or end-to-end settlement coupling.
- Round 002 is a paper-only proof, not evidence of production security.
- Launch requires security review and legal/compliance sign-off.


## Round 004 — durable available/locked PAPER funds
- V3 adds `paper_ledger_holds` keyed by immutable operation ID: asset/account/amount and ACTIVE or RELEASED state. All financial amounts remain synthetic.
- `PaperHoldService.reserve()` performs a PostgreSQL transaction with an account-row `FOR UPDATE` lock, checks total minus active holds, then persists the hold. Exact duplicate operation IDs are no-ops, reused IDs with changed intent are rejected. Released IDs never re-activate.
- `PaperHoldService.release()` checks owner/asset and serializes on the same parent account row. Duplicate release is a no-op, not a second credit.
- Every `PostgresLedger.post()` balance debit now checks `new_total >= sum(active holds)` while the parent account is locked. Ordinary journal transfers cannot spend locked funds.
- Point-in-time balance API returns `total`, `locked` and `available` from a single repeatable-read snapshot. Read-only conservation audit flags negative available funds, in addition to historical ledger drift.
- This is NOT order reservation / matching-engine settlement; future rounds must atomically consume holds for fills and fees. No release by unauthenticated public clients, no custody integration.
- Invariant: account.balance == sum(journal deltas), active holds >= 0, and every non-treasury available = total - active holds >= 0.
- Migration is disposable-schema DDL, not a production Flyway governance mechanism. DB privileged writers can bypass application rules; separate roles and append-only permissions remain open security gates.
