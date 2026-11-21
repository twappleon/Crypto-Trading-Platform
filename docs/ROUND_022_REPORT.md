# Round 022 — isolated read-only PAPER hold inspection (2026-11-21)

## Decision: Pending (submitted, not accepted)
Submitted 22; Accepted currently 19/100, Failed R001, Pending R016 and R022.

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
