# Round 007 — deterministic PAPER fees and atomic settlement
Date: 2026-11-21 (Asia/Phnom_Penh). Branch: `feat/round-002-postgres-ledger-20261120`. [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1).

## Meaningful code changes
- Added `PaperFeePolicy`: immutable maker/taker 0..1000 basis-point rates, 18-decimal BigDecimal round DOWN policy, dust treatment, and invalid-scale rejection. Buyer fee is taken from received BASE; seller fee from received QUOTE.
- Extended `PaperSettlementService`: two balanced per-asset journals now include a dedicated synthetic `paper_fee_vault` credit when fees are nonzero. Vault account rows are locked deterministically with buyer/seller account rows; order holds, settlements, balances, and immutable trade receipts remain in ONE PostgreSQL transaction. Exact replay must match the fee schedule.
- V6 migration records fee rates and actual base/quote fee amounts with SQL bounds checks. `PostgresLedger.migrate` includes V6; `PaperOrderService` blocks order creation by internal fee-vault identity.
- Added standalone negative BDD `PaperFeePolicyBDD` and five PostgreSQL integration tests in `PaperFeeRound007Test`, including fee-vault delta snapshots resilient to test execution ordering. All activity remains PAPER/SANDBOX-only.

## Evidence
- Verified source/test commit: [16d7fbf](https://github.com/twappleon/Crypto-Trading-Platform/commit/16d7fbf7710d3978662e6c9526bb12005efe9eeb).
- [GitHub Actions Run #109](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44784435281): **SUCCESS**, `Standalone negative BDD` PASS and `PostgreSQL integration and regression BDD` PASS.
- Maven CI log: **Tests run 28; Failures 0; Errors 0; Skipped 0; BUILD SUCCESS** (five Round 007 integration cases). No skipped database verification.
- Negative coverage: out-of-range fee bps, precision overflow, negative quantity, wrong fee-policy replay, self-trade and hold/ledger regressions.
- Documentation final SHA requires separate green GitHub Actions proof; do not misrepresent intermediate SHA as the final accepted documentation revision.

## Risks and blockers
- The settlement caller still chooses explicit maker/taker orders; there is NO persistent fair price/time order matching sequencer.
- Fees are hard-coded per service instance (default legacy 0 bps); there is NO authorized fee configuration API, asset-specific tick/lot grid, governance or least-privilege database access.
- Missing order/trade outbox, snapshot, deterministic replay, crash recovery and security/compliance review. Synthetic `paper_fee_vault` is not real revenue or custody.

## Next Round 008
Implement durable transactional outbox for settled PAPER trades, idempotent publisher/consumer contract and crash/replay negative BDD. Later implement authoritative FIFO matching sequencer. No real balances, wallets or chain keys.
