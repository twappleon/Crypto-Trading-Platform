# 100-round verified development ledger
| Round | Actual deliverable | Local BDD | GitHub CI | SHA | Accepted |
|---|---|---|---|---|---|
| 001 | Java 21 price-time matching, self-trade precheck, balanced idempotent in-memory journal, BDD, CI, PRD | Local test pending on exact remote content | PENDING | See commits | PENDING |
Accepted: 0/100 until GitHub CI green; do not count draft/docs-only/failing rounds.
Next rounds:
002 persisted PostgreSQL migrations; 003 atomic transfer transactions; 004 available/held balance; 005 order reservation; 006 settlement; 007 decimals and fees; 008 event outbox; 009 snapshot/replay; 010 concurrency/property tests; 011 auth skeleton.
Every round must modify meaningful code, execute BDD, update scenarios as needed, verify CI, publish SHA and test/run URL. Do not use live capital.


## Main-site P0 release (2026-11-21)
Responsive paper-only terminal source: [web/index.html](../web/index.html). Source commit [e9424b0](https://github.com/twappleon/Crypto-Trading-Platform/commit/e9424b0aa5d67394ff6c5abfcdf210a6cef83b76). Safety/static test: `node web/site-smoke.test.cjs`; CI: `.github/workflows/site.yml`. [Release gate details](SITE_RELEASE.md).
Vercel project `crypto-trading-platform-demo` was linked to `main` root `web`, but first deployment was blocked by HTTP 402 `api-deployments-free-per-day`. Actual public HTTPS verification PENDING. **Do not mark this site milestone Accepted or increment 100-round count until CI and deployed browser E2E pass.**
Separate development branch `feat/round-002-postgres-ledger-20261120` has the canonical R002–R008 7/100 Accepted ledger; main branch has not merged it. After merging, reconcile counters rather than adding duplicated rounds.
