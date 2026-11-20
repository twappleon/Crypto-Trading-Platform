# 100-round verified development ledger
| Round | Actual deliverable | Local BDD | GitHub CI | SHA | Accepted |
|---|---|---|---|---|---|
| 001 | Java 21 price-time matching, self-trade precheck, balanced idempotent in-memory journal, BDD, CI, PRD | Local test pending on exact remote content | PENDING | See commits | PENDING |
Accepted: 0/100 until GitHub CI green; do not count draft/docs-only/failing rounds.
Next rounds:
002 persisted PostgreSQL migrations; 003 atomic transfer transactions; 004 available/held balance; 005 order reservation; 006 settlement; 007 decimals and fees; 008 event outbox; 009 snapshot/replay; 010 concurrency/property tests; 011 auth skeleton.
Every round must modify meaningful code, execute BDD, update scenarios as needed, verify CI, publish SHA and test/run URL. Do not use live capital.
