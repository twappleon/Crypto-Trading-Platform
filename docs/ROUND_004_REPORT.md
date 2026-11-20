# Round 004 — durable PAPER reservations (2026-11-20)

## Actual code
- New V3 PostgreSQL table `paper_ledger_holds`: immutable ID, asset/owner, numeric amount, ACTIVE/RELEASED state and index.
- New `PaperHoldService` with account-row locked reserve, idempotent duplicate handling, release guard and point-in-time available/locked/total read.
- `PostgresLedger.post` rejects transfers that would make total smaller than active holds, under the same account lock.
- Conservation audit now checks for negative available balances.
- New 5-case `PaperHoldRound004Test`: replay, unauthorized release, overdraft, concurrency, and negative SQL hold amount.
- Migration loader fixed to parse V3 by explicit `-- @statement` delimiters, after CI #52 exposed a semicolon-in-comment parser error.

## Verification
- Initial CI [Run #52](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754197274): FAILED due V3 migration loader splitting semicolons in comments; fixed in parser and V3 schema.
- Intermediate [Run #60](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754451063): FAILED 1/13 due cross-account hold-ID conflict misclassified as insufficient balance; corrected before account lookup.
- **Accepted code SHA:** [87f8c64](https://github.com/twappleon/Crypto-Trading-Platform/commit/87f8c6487d1b85d189b2e6d4f77546819898819b).
- **Verified GitHub Actions:** [Run #64 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754663669), PostgreSQL service + standalone BDD PASS, **13/13 JUnit PASS, zero errors/failures/skips**.
- Round 004 **ACCEPTED** based on exact-code-SHA CI success; documentation-only follow-up commits require their own green CI checks but do not add another Accepted round.

## Restrictions and next gate
PAPER/SANDBOX ONLY. No real deposits, chain custody, wallets, private keys or order submission to an external exchange. Holds do not yet settle matched trades. Round 005 must bind order IDs, quote/base collateral and idempotent cancellation to durable holds; Round 006 must atomically settle fills and fees.
