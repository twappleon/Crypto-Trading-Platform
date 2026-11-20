# Round 002 — PostgreSQL paper-ledger implementation and verification

Date: 2026-11-20 (UTC). Scope: **PAPER/SANDBOX** balances only, no live transfers.

## Deliverables
- PostgreSQL 16 schema: `paper_ledger_accounts`, `paper_ledger_journals`, `paper_ledger_entries`.
- `PostgresLedger` Java 21 JDBC implementation: balanced double-entry journal, global idempotency key, fingerprint matching, deterministic account row locking, all-or-nothing SQL transactions, precision checking, and overdraft rejection.
- BDD for synthetic credit, repeated ID, changed payload, persistence across new object/connection, insufficient funds, balanced entry sum and competing concurrent debits.
- Repaired a baseline Round 001 bug: `Map.of(...).containsValue(null)` incorrectly raised NPE in the in-memory journal. Added regression.
- Maven JUnit tests, PostgreSQL CI service, and independent JDK-only negative BDD.

## Evidence
- Verified source commit: [`14fbf632c4d1591d61c06b6a8c9161789d0bd5e9`](https://github.com/twappleon/Crypto-Trading-Platform/commit/14fbf632c4d1591d61c06b6a8c9161789d0bd5e9).
- GitHub Actions: [run #25](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44737212887), **completed / success** on the above SHA.
- Standalone BDD: **PASS**, matching, FIFO, cancellation, validation, self-trade protection and legacy ledger; SQL input-validation negative BDD **PASS**.
- PostgreSQL Integration: JUnit **2 tests / 0 failures / 0 errors / 0 skipped**.
- Core BDD via JUnit: **2 tests / 0 failures / 0 errors / 0 skipped**.
- Maven aggregate **4 tests / 0 failures / 0 errors / 0 skipped; BUILD SUCCESS**.
- Review: [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1).

## Acceptance
Round 002: **Accepted** (meaningful code change + CI success + negative BDD + recorded SHA).
Original Round 001: **Pending/Not accepted** (initial revision failed the baseline in-memory BDD). Round 002 fixed it; keep independent round accounting conservative.

## Remaining P0 blockers
There is still no atomic integration between matching engine and ledger balances, no hold/reserve or cancellation release, no database-enforced per-journal sum trigger, no crash replay/reconciliation, and no live-ready security controls. Production use is prohibited.

Next: Round 003 — DB-side conservation verification, classified retry handling and rollback tests.
