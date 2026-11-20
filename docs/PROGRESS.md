# 100-round verified development ledger

## Current accounting (2026-11-20)
**Submitted: 4** rounds. **Accepted: 2/100** (002, 003). **Pending/failed: 2** (001 failed, 004 pending CI).

| Round | Actual source change | BDD & negative tests | GitHub CI | Source SHA | Accepted |
|---|---|---|---|---|---|
| 001 | Java 21 price/time matching + prototype in-memory journal | Original version failed standalone BDD due `Map.of.containsValue(null)` NPE; fixed during Round 002 | Original SHA has no green proof | [dcef059](https://github.com/twappleon/Crypto-Trading-Platform/commit/dcef059d56e49003b66ecb4d47630d3b07148fad) | **NO** |
| 002 | Durable PostgreSQL journal, atomic balances, SQL migration, idempotency, collision/overdraft/precision handling, baseline bugfix, JUnit CI | Standalone BDD PASS; PostgreSQL 2 integration + 2 core JUnit tests; **4 passed, 0 failed/errors/skipped** | [**SUCCESS** — run #25](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44737212887) | [14fbf63](https://github.com/twappleon/Crypto-Trading-Platform/commit/14fbf632c4d1591d61c06b6a8c9161789d0bd5e9) | **YES** |
| 003 | V2 deferred conservation/append-only triggers, read-only reconciliation, SQLSTATE retry classification and rollback BDD | Standalone BDD PASS; **8 JUnit passed**, 0 failures/errors/skipped (4 new Round 003 integration) | [**SUCCESS — Run #34**](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44745047231) | [b3d52c7](https://github.com/twappleon/Crypto-Trading-Platform/commit/b3d52c757b2c1c641e2e0e034151b18076d944d0) | **YES** |
| 004 | PostgreSQL-backed durable paper holds; per-account available/locked snapshot; debit protection against active reservations; V3 migration parse fix | New 5-case PostgreSQL hold/release, unauthorized, oversubscription and negative tests | Initial [Run #52 FAILED](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44754197274) (SQL comment delimiter); retry CI pending | [cb1ea75](https://github.com/twappleon/Crypto-Trading-Platform/commit/cb1ea758fe3c50eefd7ebcdf1fab3e35d17c12d1) | **PENDING** |

[Round 002 report](ROUND_002_REPORT.md) · [Round 003 report](ROUND_003_REPORT.md) · [Round 004 report](ROUND_004_REPORT.md) · [Draft PR #1](https://github.com/twappleon/Crypto-Trading-Platform/pull/1)

## Accounting and safety
A round counts only for meaningful source changes and executable BDD/negative tests, a verified GitHub Actions SUCCESS on an exact SHA and a committed progress entry. Rework on a failed round belongs to the actual round that fixes it, not automatic retroactive completion. GitHub tests use synthetic paper balances only. No real asset transfers, private keys, on-chain custody or production operations.

## Next P0 rounds
003: Accepted DB-side journal conservation, classified retries and rollback BDD (8 JUnit PASS; CI #34).
004: Submitted available/locked balances with safe hold/release; pending final CI acceptance.
005: Limit-order reservation idempotency.
006: Maker-price atomic trade settlement and hold release.
007: Decimal precision, fees and deterministic rounding.
008: Transactional outbox.
009: Crash recovery/replay.
010: High-contention property/invariant tests.
011+: Auth/MFA, KYC sandbox, APIs/WebSockets, admin, frontend, E2E and hardening.

**Unresolved production gates:** matching + ledger are not transactionally coupled, holds are not order/settlement-coupled, database least-privilege policy is absent, and deployment, legal/compliance and independent security review remain incomplete. Demo only.
