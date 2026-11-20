# Round 008 — transactional PAPER trade outbox
Date: 2026-11-21. Branch: `feat/round-002-postgres-ledger-20261120`.
[Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1).

## Source changes
- V7 adds FK-bound `paper_trade_outbox` and unique `paper_trade_consumer_inbox` (paper only).
- PaperSettlementService inserts a trade-scoped outbox intent BEFORE the SAME PostgreSQL COMMIT as fee-aware base/quote journals, balances, order updates, holds and immutable trade receipt.
- PaperOutboxService provides one-minute lease, `SKIP LOCKED` concurrent claims, UUID token-fenced acknowledgements, expiration retry and durable consumer-side receipt deduplication. No external delivery is performed.
- Five PostgreSQL BDD cases test success/idempotency, rejected transaction/orphan foreign-key, expired/stale claim, consumer dedup across service restart and concurrent claim winner.

## Verification
- Code/tests pushed to [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1).
- **Accepted** (7/100 cumulative): code/test SHA [f9c9c3d](https://github.com/twappleon/Crypto-Trading-Platform/commit/f9c9c3d9cabd023a2ec21130011f7e33f399faa7), [GitHub Actions Run #126](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44793845793) **SUCCESS**.
- Verified GitHub job logs: Standalone BDD PASS; Maven/JUnit with PostgreSQL 16 **33 tests run; 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**, including 5 Round 008 integration cases.
- Documentation SHA is separate and must be verified in GitHub Actions before it is described as green.

## Known limitations and next steps
- Outbound delivery is at-least-once, not exactly-once; a future consumer must atomically commit its own side effect and dedup marker.
- Still no durable FIFO automated matcher, production DB roles, chain custody, real-money controls, authenticated API, deployable frontend or independent compliance/security review.
- Next Round 009: restart/crash replay worker, authoritative FIFO matching arbitration and reconciliation.
