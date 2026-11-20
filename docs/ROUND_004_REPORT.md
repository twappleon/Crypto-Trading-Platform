# Round 004 — durable PAPER reservations (2026-11-20)

## Actual code
- New V3 PostgreSQL table `paper_ledger_holds`: immutable ID, asset/owner, numeric amount, ACTIVE/RELEASED state and index.
- New `PaperHoldService` with account-row locked reserve, idempotent duplicate handling, release guard and point-in-time available/locked/total read.
- `PostgresLedger.post` rejects transfers that would make total smaller than active holds, under the same account lock.
- Conservation audit now checks for negative available balances.
- New 5-case `PaperHoldRound004Test`: replay, unauthorized release, overdraft, concurrency, and negative SQL hold amount.
- Migration loader fixed to parse V3 by explicit `-- @statement` delimiters, after CI #52 exposed a semicolon-in-comment parser error.

## Verification
- Initial CI [Run #52](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754197274): FAILED due V3 migration loader treating SQL comment semicolon as a statement delimiter. A corrective code/schema commit followed.
- Final correction SHA: cb1ea758fe3c50eefd7ebcdf1fab3e35d17c12d1 (subject to subsequent docs commits).
- Follow-up CI: PENDING — **do not count as Accepted until an exact-sha GitHub Actions SUCCESS, including Maven/PostgreSQL and BDD, is verified**.

## Restrictions and next gate
PAPER/SANDBOX ONLY. No real deposits, chain custody, wallets, private keys or order submission to an external exchange. Holds do not yet settle matched trades. Round 005 must bind order IDs, quote/base collateral and idempotent cancellation to durable holds; Round 006 must atomically settle fills and fees.
