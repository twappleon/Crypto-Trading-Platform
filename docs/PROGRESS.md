# 100-round verified development ledger

## Current accounting (2026-11-21)
**Submitted: 7** rounds. **Accepted: 6/100** (002, 003, 004, 005, 006, 007). **Pending/failed: 1** (original 001).
Round 007 source SHA CI is green; verify final documentation SHA via Actions separately.

| Round | Actual source change | BDD & negative tests | GitHub CI | Source SHA | Accepted |
|---|---|---|---|---|---|
| 001 | Java 21 price/time matching + prototype in-memory journal | Original version failed standalone BDD due `Map.of.containsValue(null)` NPE; fixed during Round 002 | Original SHA has no green proof | [dcef059](https://github.com/twappleon/Crypto-Trading-Platform/commit/dcef059d56e49003b66ecb4d47630d3b07148fad) | **NO** |
| 002 | Durable PostgreSQL journal, atomic balances, SQL migration, idempotency, collision/overdraft/precision handling, baseline bugfix, JUnit CI | Standalone BDD PASS; PostgreSQL 2 integration + 2 core JUnit tests; **4 passed, 0 failed/errors/skipped** | [**SUCCESS** — run #25](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44737212887) | [14fbf63](https://github.com/twappleon/Crypto-Trading-Platform/commit/14fbf632c4d1591d61c06b6a8c9161789d0bd5e9) | **YES** |
| 003 | V2 deferred conservation/append-only triggers, read-only reconciliation, SQLSTATE retry classification and rollback BDD | Standalone BDD PASS; **8 JUnit passed**, 0 failures/errors/skipped (4 new Round 003 integration) | [**SUCCESS — Run #34**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44745047231) | [b3d52c7](https://github.com/twappleon/Crypto-Trading-Platform/commit/b3d52c757b2c1c641e2e0e034151b18076d944d0) | **YES** |
| 004 | PostgreSQL-backed durable paper holds, available/locked snapshots, debit protection and corrected migration / idempotency conflict | Independent BDD PASS; **13/13 JUnit PASS**, including 5 new PostgreSQL hold tests | [**SUCCESS — Run #64**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754663669) | [87f8c64](https://github.com/twappleon/Crypto-Trading-Platform/commit/87f8c6487d1b85d189b2e6d4f77546819898819b) | **YES** |
| 005 | PostgreSQL persisted per-order BUY/SELL paper reserves + immutable replay and cancel/release transaction | Independent BDD PASS; **18/18 JUnit**, 5 new integration tests, 0 failures/errors/skips | [**SUCCESS — Run #85**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44764831746) | [39d0812](https://github.com/twappleon/Crypto-Trading-Platform/commit/39d08126acc4f1317cb261c9191d4eb18a946085) | **YES** |

| 006 | V5 explicit-pair atomic PAPER fill: two balanced asset journals, maker-price execution, immutable trade receipts, partial/final order states and holds, partial cancellation | Standalone BDD PASS; PostgreSQL/JUnit **23/23 PASS** (5 new Round 006 tests), 0 failures/errors/skipped | [**SUCCESS — Run #93**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44774297393); initial Run #90 failed one wrong exception assertion, corrected | [7641e07](https://github.com/twappleon/Crypto-Trading-Platform/commit/7641e07b5955c5b0c1c80b291e6778764bf1cfdf) | **YES** |

| 007 | Atomic PAPER maker/taker fee settlement: BigDecimal 18-decimal floor, fee-vault per-asset balanced journal, V6 immutable fee receipts and replay fee-rate conflict | Standalone Round 007 BDD PASS; PostgreSQL JUnit **28/28 PASS** including 5 fee tests; 0 failures/errors/skips | [**SUCCESS — Run #109**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44784435281) | [16d7fbf](https://github.com/twappleon/Crypto-Trading-Platform/commit/16d7fbf7710d3978662e6c9526bb12005efe9eeb) | **YES** |

[Round 002 report](ROUND_002_REPORT.md) · [Round 003 report](ROUND_003_REPORT.md) · [Round 004 report](ROUND_004_REPORT.md) · [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1)

## Accounting and safety
A round counts only for meaningful source changes and executable BDD/negative tests, a verified GitHub Actions SUCCESS on an exact SHA and a committed progress entry. Rework on a failed round belongs to the actual round that fixes it, not automatic retroactive completion. GitHub tests use synthetic paper balances only. No real asset transfers, private keys, on-chain custody or production operations.

## Next P0 rounds
003: Accepted DB-side journal conservation, classified retries and rollback BDD (8 JUnit PASS; CI #34).
004: Accepted available/locked balances and safe hold/release (13 JUnit PASS, Run #64 SUCCESS).
005: Accepted durable order reservation + cancel/release (18/18 JUnit, CI Run #85 SUCCESS).
006: Accepted explicit-pair maker-price atomic PAPER settlement, partial/final fills, and hold release (23/23 JUnit, CI #93).
007: Accepted atomic maker/taker fees, deterministic 18-decimal floor, dedicated synthetic fee vault and receipt audit (28 JUnit PASS, Run #109).
008: Transactional outbox, idempotent publish and crash-safe replay.
009: Crash recovery/replay.
010: High-contention property/invariant tests.
011+: Auth/MFA, KYC sandbox, APIs/WebSockets, admin, frontend, E2E and hardening.

**Unresolved production gates:** no automated price/time trading sequencer or FIFO enforcement across persisted orders; explicit-pair settlement only. No crash recovery, fee policy, database least-privilege policy, production deployment, legal/compliance or independent security review. Demo only.


## Round 005 submission (2026-11-20)
**Submitted 5; Accepted 4/100. Exact source/documentation SHA 39d0812 has GitHub Actions Run #85 SUCCESS.**
- Feature: `PaperOrderService` + V4 persisted orders, atomic per-order collateral lock/release and reserved `order:` namespace; invalid amount/identity/collision fail closed.
- BDD: 5 PostgreSQL integration cases (BUY/SELL reserve + durable lookup, immutable replay/cancel, negative/overdraft, hold collision rollback, 12-way concurrent orders).
- Code commit: [261da8d](https://github.com/twappleon/Crypto-Trading-Platform/commit/261da8d367dfa46dc89bb15202290d78af75d6e6).
- **Verification:** [GitHub Actions Run #85 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44764831746), standalone BDD PASS, 18/18 JUnit PASS; zero failures/errors/skips. Final ledger-only SHA requires a second CI run before completion is reported.
- [Round 005 report](ROUND_005_REPORT.md). Next P0 Round 006: matching engine + transactionally coupled partial-fill settlement, maker-price quote refunds, and cancellation race arbitration.


## Round 006 submission (2026-11-20)
**Submitted 6; Accepted 5/100** based on the exact source SHA [7641e07](https://github.com/twappleon/Crypto-Trading-Platform/commit/7641e07b5955c5b0c1c80b291e6778764bf1cfdf) and [GitHub Actions Run #93 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44774297393). The documentation-only ledger commit itself also needs a green CI before final publication.
- Code: V5 PAPER trade lifecycle, \`PaperSettlementService\` with buyer/seller journals + remaining-hold consumption in one DB transaction, maker price, idempotency and cancellation integration.
- BDD: five new PostgreSQL tests; overall 23/23 tests + standalone BDD, zero failures/errors/skips. First [Run #90](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44773949539) was RED because uncrossed-order test wrongly expected canceled-state exception; corrected and separately tested both paths, then [Run #93](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44774297393) was GREEN.
- [Round 006 report](ROUND_006_REPORT.md). Next P0 Round 007: price/quantity precision, fee calculation, deterministic rounding, explicit settlement event reconciliation, then persistent FIFO matcher and crash replay.
- Limitation: explicit trusted maker/taker selection is required. No public trade API, no live funds or chain custody.

## Round 007 submission (2026-11-21)
**Submitted 7; Accepted 6/100** based on meaningful fee-settlement code SHA [16d7fbf](https://github.com/twappleon/Crypto-Trading-Platform/commit/16d7fbf7710d3978662e6c9526bb12005efe9eeb) and [GitHub Actions Run #109 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44784435281).
- Code: 18-decimal fee rounding, maker/taker BPS validation, fee-vault balanced per-asset journal, V6 stored fee rates/charged amounts and fee-rate idempotency replay guard.
- BDD: standalone negative scenarios plus 5 new PostgreSQL tests; **28/28 JUnit PASS**, zero failures/errors/skips. PostgreSQL 16 CI verifies order/hold/ledger regression.
- [Round 007 report](ROUND_007_REPORT.md). Draft [PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1).
- **Next 008:** transactional outbox for paper fills + idempotent replay; subsequently persistent FIFO sequencer, crash recovery and authoritative reconciliation.
- Blockers: no matching sequencer, no real API/frontend, no production DB role isolation/security audit; PAPER only.
