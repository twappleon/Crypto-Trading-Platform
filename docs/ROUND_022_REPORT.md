# Round 022 — isolated read-only PAPER hold inspection (2026-11-21)

## Final decision: ACCEPTED after independent main + production gates
Submitted 22; Accepted 20/100, Failed R001, Pending R016 only. Initial submitted state is superseded by the verification below.

## Changes
- `web/api/paper-balances.js`: shared HMAC verifier accepts an explicit scope without changing default `paper:balances:read`.
- `web/api/paper-holds.js`: GET/HEAD only, HMAC `paper:holds:read`, PostgreSQL repeatable-read READ ONLY, signed-subject SQL `$1`, limit 101 to detect >100/partial snapshot, strict amount precision and states. Private no-store and no CORS. 401/405/503 fail-closed. No token issuer or public mutations.
- `web/paper-holds.test.cjs`: malicious credential, cross-owner override, forbidden methods, no DB on bad auth, precision/corruption, truncation and data secrecy BDD.
- `qa/paper-holds.pg.test.cjs`: real PostgreSQL 16 account isolation, ACTIVE/RELEASED visibility after commit, corrupt precision 503, limit=101 503 and recovery. Only synthetic CI fixture data.
- `qa/paper-holds.public.test.cjs`: live anonymous HTTPS reads are 401/503 with no records and POST is 405, no private data.
- Update Site/PostgreSQL CI, public browser release CI, README, PRD, BDD, PROGRESS.

## Strict acceptance gates
1. PR Site+PostgreSQL and Core BDD pass, merged main SHA Site+PostgreSQL and Core BDD pass.
2. Vercel Production READY with exact feature-bearing main SHA, not just stale HTML or branch preview.
3. Unauthenticated public HTTPS and API negative test pass; public desktop/390px mobile Chromium with screenshots and website hash match source.
4. Update this report and PROGRESS only with observed links/status; never mark Accepted based on code submission alone.

## Boundaries
The publicly browsable v1.0 trading terminal is still volatile BROWSER MEMORY ONLY. Reservations are not order fills, a matching engine or a user-visible durable account. No real trading, funds, on-chain transactions, keys, KYC or deposits. R016 ignored-build step remains Pending.


## Final acceptance evidence — 2026-11-21
- [Merged PR #15](https://github.com/twappleon/Crypto-Trading-Platform/pull/15), [feature main SHA `499bfa77`](https://github.com/twappleon/Crypto-Trading-Platform/commit/499bfa77bf4055195301259c392c797a52731548).
- [PR Site/PG/local Chromium SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884748582); [PR Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884748599).
- [Main Site + PostgreSQL 16 + local browser CI SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794213); [main Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794257).
- [Vercel READY Production dpl_3JWMZNBCEACnEJEBZmiwpn3vF5JN](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/3JWMZNBCEACnEJEBZmiwpn3vF5JN) reports GitHub main `499bfa77bf4055195301259c392c797a52731548`.
- [Public HTTPS exact HTML hash / safe anonymous balances + holds API / desktop + 390px mobile Chromium E2E — SUCCESS attempt 2](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794182/attempts/2). [Public screenshot artifact #14699491503](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794182/artifacts/14699491503).
- Initial public release attempt failed 404 because the new API had not propagated to the alias. Retried after Production READY; no earlier failing attempt counted. Public `GET /api/paper-holds` returns 503 without PostgreSQL configuration, and POST 405, intentionally. Public site remains browser-local demonstration; no authenticated persistent browser order entry.

**Result:** R022 Accepted; tally 20/100. R016 remains Pending. Next P0 is sandbox-only identity/session and *atomic persisted PAPER orders*, then browser reload/negative E2E. Never enable real funds, on-chain operations, customer KYC or private keys.
