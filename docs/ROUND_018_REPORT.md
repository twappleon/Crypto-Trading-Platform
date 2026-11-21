# Round 018 — server-side authenticated PAPER PostgreSQL balance read boundary

Date: 2026-11-21. **Submitted / Pending**. No claims of public persistent trading.

## Source
- `web/api/paper-balances.js`: GET/HEAD only; short-lived HMAC-SHA256 bearer capability bound to one account and read-only balance scope; token subject originates **only** from verified signature. PostgreSQL repeatable-read READ ONLY snapshot across `paper_ledger_accounts` and `paper_ledger_holds`, with parameterized account_id. Return exact NUMERIC strings for total, locked and available (BTC/USDC).
- `web/package.json`: Node `pg` server-side dependency. **Credentials must be supplied via Vercel environment variables**, never checked into GitHub.
- `web/paper-balances.test.cjs`: executable positive/negative tests using a strictly mocked database adapter. This is **not** a live PostgreSQL integration test.
- The public terminal remains **v0.8 until v0.9/R017 deploy succeeds**. The new API never sends browser orders or balances to the server and never issues auth tokens publicly.

## Security / operational gates
- Missing `PAPER_DATABASE_URL` or 32+ character `PAPER_SESSION_SECRET`: HTTP 503. Missing/expired/tampered/overlong or overprivileged bearer: 401. Any write method: 405. SQL errors/invalid NUMERIC response: 503. No credentials, query, account ID or database errors reflected, no CORS or cache.
- This endpoint assumes the isolated PostgreSQL **paper_ledger_accounts** and **paper_ledger_holds** schemas already exist, with **synthetic funds only**. Those schemas still live on the separate backend prototype branch and must be migrated deliberately before env configuration.
- There is no public token issuer, user account provisioning, authenticated order POST, persistent public balances, real matching or reconciliation endpoint. An operational release requires isolated DB, least-privilege read-only DB credentials, token issuance/revocation, real PostgreSQL integration tests, manual security gate and public HTTPS/browser tests.

## Acceptance checklist
- [ ] Exact source SHA in GitHub PR + merged main, Site/Node negative BDD and Core BDD SUCCESS.
- [ ] Vercel `main` Production READY at matching source SHA, public HTTPS 200 and desktop/mobile browser E2E including GET unauthenticated /api/paper-balances = 401 when configured, or 503 when intentionally disabled.
- [ ] PostgreSQL integration tests against an isolated paper-only schema (not mocked).
- [ ] Complete tracked evidence in docs/PROGRESS.md.

**Do not count R018 Accepted until all gates pass**. No real money, token purchase, deposits, custody, KYC, private keys or blockchain actions.
