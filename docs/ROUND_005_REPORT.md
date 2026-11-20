# Round 005 — Accepted (CI Run #85 SUCCESS)

**Repo:** https://github.com/twappleon/Crypto-Trading-Platform
**Draft PR:** https://github.com/twappleon/Crypto-Trading-Platform/pull/1
**Acceptance ledger:** 5 submitted, 4 accepted (Rounds 002–005), 001 failed.
**Mode:** PAPER/SANDBOX ONLY.

## Implementation
- V4 PostgreSQL `paper_limit_orders` table stores durable, immutable order intent with linked collateral ID.
- `PaperOrderService.place` atomically reserves full BUY quote limit cost / SELL base quantity and inserts one order. Parent ledger-account row serialization prevents oversubscription.
- `PaperOrderService.cancel` atomically releases active order hold and records cancellation, subject to owner checks; identical replay no-ops.
- Direct `PaperHoldService` writes to order-held namespace rejected.
- 5 new integration scenarios including negative identity/overdraft/precision, 12 concurrent requests and collision rollback; existing in-memory BDD retained.

## Verification
- [GitHub Actions Run #85](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44764831746) SUCCESS on [39d0812](https://github.com/twappleon/Crypto-Trading-Platform/commit/39d08126acc4f1317cb261c9191d4eb18a946085). Standalone BDD PASS; PostgreSQL + core JUnit **18 tests, 0 failures, 0 errors, 0 skipped**, including 5 new Round 005 integration tests. Final docs SHA CI also must be checked.
- Local infrastructure cannot resolve github.com directly and no disposable PostgreSQL/Maven is available in the local container; GitHub Actions PostgreSQL 16 is the required integration proof.

## Open risk / next round
No matching execution, fee handling, partial holds or fill settlement. Round 006 must implement durable order-book sequencing, maker-price atomic settlement, partial fill residual collateral and cancellation race protection. Users are **not** allowed to execute trades, send crypto, use real money or provide KYC secrets.
