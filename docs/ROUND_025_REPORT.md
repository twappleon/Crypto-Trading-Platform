# Round 025 — Signed PostgreSQL PAPER release API (verification pending)

- Date: 2026-11-21 (Asia/Phnom_Penh)
- Baseline main: `274308b32f9564eec5936489aa6ed1ffa98b3fbd` (R024 accepted at Vercel `6a3b488d`)
- Branch: `feat/round-025-paper-release-20261121`
- Scope: POST `/api/paper-release`, opt-in server-only, signed scope and owner isolation, exact-id body, PostgreSQL atomic release and replay.
- Negative BDD: disabled feature 503, invalid method 405, token 401, browser Origin 403, strict JSON 400/415, foreign/unknown hold 409, DB failures 503; none echo identifiers/secrets.
- PostgreSQL 16 BDD: dispose-only accounts, 30 USDC hold out of 100, two simultaneous cancellations, exactly one release, 200 replay, funds never double credited or reserved again.
- Website remains a static synthetic browser-only paper terminal. The release endpoint is not a live order/settlement or custody feature and has no public token issuer.
- **Current status: Pending.** Capture PR/commit, main CI, Vercel deployment SHA and public screenshot links after verification. Do not increment Accepted in advance.
