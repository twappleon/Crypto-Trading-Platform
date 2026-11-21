# Round 025 — Signed PostgreSQL PAPER release API (ACCEPTED)

- Date: 2026-11-21 (Asia/Phnom_Penh)
- Baseline main: `274308b32f9564eec5936489aa6ed1ffa98b3fbd` (R024 accepted at Vercel `6a3b488d`)
- Branch: `feat/round-025-paper-release-20261121`
- Scope: POST `/api/paper-release`, opt-in server-only, signed scope and owner isolation, exact-id body, PostgreSQL atomic release and replay.
- Negative BDD: disabled feature 503, invalid method 405, token 401, browser Origin 403, strict JSON 400/415, foreign/unknown hold 409, DB failures 503; none echo identifiers/secrets.
- PostgreSQL 16 BDD: dispose-only accounts, 30 USDC hold out of 100, two simultaneous cancellations, exactly one release, 200 replay, funds never double credited or reserved again.
- Website remains a static synthetic browser-only paper terminal. The release endpoint is not a live order/settlement or custody feature and has no public token issuer.
- **ACCEPTED — 24/100.** [PR #18](https://github.com/twappleon/Crypto-Trading-Platform/pull/18) merged as [main feature SHA 3bec15b2](https://github.com/twappleon/Crypto-Trading-Platform/commit/3bec15b2d481a659b71c08c542becb1a2ed56665).
- [Main Site + real PG16 + desktop/mobile Chromium CI SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44899482389) and [Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44899482398).
- [Vercel main → Production READY exact SHA](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/CvYwDeQXy88RgFkJBs7jLkrmnc7P).
- [Public HTTPS, API safe denial, desktop/390px Chromium SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44899482408) and [PUBLIC screenshot artifact](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44899482408/artifacts/14705855667).
- Public `/api/paper-release` GET=405, unsigned POST denied, and `paper-status` GET=200 NOT_READY. No public persistent orders or real money.
