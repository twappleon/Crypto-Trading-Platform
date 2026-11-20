# Round 003 — DB-side ledger conservation, retries, and rollback BDD

Date: 2026-11-20. Scope: PAPER/SANDBOX ONLY.

## Real source changes
1. V2 PostgreSQL migration adds initially deferred commit-time constraint triggers for newly inserted journal/entry rows. A missing or unbalanced journal is rejected on COMMIT with SQLSTATE 23514.
2. PostgreSQL BEFORE triggers reject UPDATE/DELETE on committed journal entries and journal headers with SQLSTATE 55000.
3. `PostgresLedger.verifyConservation()` reads SQL aggregate invariants for journal sums/counts and account balances versus ledger entry sums; never repairs on its own.
4. `postWithRetry()` uses the same idempotency ID, bounded attempts (1..5), retries only 40001 / 40P01, and fails closed on uncertain commit (08006) or permanent SQL faults.
5. JUnit integration BDD introduces direct-SQL bad insert rollback, immutability, privileged balance drift detection, transient SQLSTATE injection, and fail-closed negative tests.

## Verified evidence
- Domain source SHA: [b984e37](https://github.com/twappleon/Crypto-Trading-Platform/commit/b984e37d3731b048384763959eb02864c4cf866a)
- Round 003 integration test SHA: [b3d52c7](https://github.com/twappleon/Crypto-Trading-Platform/commit/b3d52c757b2c1c641e2e0e034151b18076d944d0)
- Branch/PR: [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1)
- Verified source SHA: [b3d52c757b2c1c641e2e0e034151b18076d944d0](https://github.com/twappleon/Crypto-Trading-Platform/commit/b3d52c757b2c1c641e2e0e034151b18076d944d0), includes V2/ledger code and 4 new tests.
- GitHub Actions: [Run #34 — SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44745047231) on the exact source SHA, completed 2026-11-20 13:32 UTC.
- Standalone BDD: PASS (matching, FIFO, cancellation, input validation, self-trade prevention; SQL ledger negatives).
- PostgreSQL JUnit: existing integration 2 PASS, Round 003 integration 4 PASS, Core JUnit 2 PASS. **Aggregate: 8 passed, 0 failed/errors/skipped; BUILD SUCCESS.**
- Round 003 Accepted: **YES** on verified source SHA and recorded passing CI; progress ledger updated accordingly.

## Known limitations
- PostgreSQL owner/superuser can bypass/replace triggers; direct privileged updates to account balances are detected by audit, not prevented.
- Not atomic with the matching engine; no reservations/held balances, durable replay, KYC, web UI or production auth.
- No automatic handling of ambiguous commit outcomes; caller must reconcile by stable journal ID.
- Demo migrations are not a hardened production migration strategy.

## Next
After CI green: Round 004 — available/locked paper balances with idempotent reserve/release and concurrent overdraft prevention.
