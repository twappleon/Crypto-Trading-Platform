# 100-round verified development ledger

## Current accounting
Submitted rounds: **2/100** (001 on main; 002 on review branch).
Accepted rounds: **0/100** until direct GitHub Actions SUCCESS evidence is captured.
Do not count docs-only work, failed CI, or unverified tests. Pending is not a success.

| Round | Actual source changes | Standalone BDD | PostgreSQL BDD | GitHub Actions | Commit | Accepted |
|---|---|---|---|---|---|---|
| 001 | Java 21 order matching, self-trade precheck, in-memory journal + negative BDD | Not independently evidenced | N/A | No verified successful run | [dcef059](https://github.com/twappleon/Crypto-Trading-Platform/commit/dcef059d56e49003b66ecb4d47630d3b07148fad) | PENDING |
| 002 | PostgreSQL ledger/schema, atomic double-entry SQL, idem, precision/negative safety, concurrent integration BDD | CI triggered by PR; result pending | CI triggered by PR; result pending | PENDING | [Round 002 PR](https://github.com/twappleon/Crypto-Trading-Platform/pulls) | PENDING |

## Operational rules
Always read latest code, requirements, BDD, SHA and CI. One accepted round requires meaningful source change, executable tests, verifiable green CI, exact SHA and this ledger updated. A later PR green result may validate earlier source but do not retroactively count a round without precise evidence. Keep outstanding bugs visible.

## Next P0 rounds
003: robust PostgreSQL transaction retry classification and journal conservation check (no false accepted SQL failures).
004: available vs locked balance model with atomic hold/release.
005: limit-order reservation idempotency.
006: trade settlement at maker price and holds release.
007: fees and deterministic rounding.
008: transactional event outbox.
009: recovery/replay.
010: concurrent matching and ledger invariant property tests.
011+: secure API/authentication then integration and front-end.

**Blocked:** external GitHub CI success is mandatory before Accepted count advances. Not a production-ready or real-asset platform.
