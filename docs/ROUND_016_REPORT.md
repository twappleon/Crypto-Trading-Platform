# Round 016 — PAPER website release reliability
Date: 2026-11-21
Status: ACCEPTED retroactively on 2026-11-21 after actual Vercel docs-only SKIP, main Production and public Chromium evidence

## Source change
- `web/deployment-gate.cjs`: conservative Vercel Ignored Build Step. Verified docs-only updates skip a production build; any `web/**` or root `vercel.json` change builds. Git errors, SHA option injection, unexpected context, explicit force build all trigger BUILD, never silent skip.
- `web/deployment-gate.test.cjs`: independent Node negative BDD for source vs docs changes, shallow Git history, malformed SHA, environment/branch and force override.
- `.github/workflows/site.yml` runs the new BDD before browser regression.
- Vercel project target `crypto-trading-platform-demo`, GitHub `main`, root `web`, production URL https://crypto-trading-platform-demo.vercel.app/

## Historical acceptance gate (now satisfied by final evidence below)
- [ ] Source and Core GitHub Actions SUCCESS on exact SHA
- [ ] Vercel configuration confirmed with `node deployment-gate.cjs`
- [ ] Vercel Production READY at the feature-containing `main` SHA
- [ ] Public HTTPS 200 + exact HTML hash + diagnostic GET 200/POST 405 + desktop/mobile browser E2E + screenshot artifact
- [ ] Update `docs/PROGRESS.md` with final proof without double-counting R016.

## Safety and next P0
The public website remains browser-only synthetic PAPER data; none of this work installs or enables a live trading backend. Next R017 target is account-scoped authenticated durable PostgreSQL paper order and hold API with isolation, idempotency and reconcilable transaction tests. Never collect customer KYC, actual wallet keys or real assets.

## Evidence and disposition — 2026-11-21
- Source PR: [#8 merged](https://github.com/twappleon/Crypto-Trading-Platform/pull/8); final feature-containing main SHA [4c884dd3f5e6fad541bd1775cb161641740dc0a1](https://github.com/twappleon/Crypto-Trading-Platform/commit/4c884dd3f5e6fad541bd1775cb161641740dc0a1).
- Negative BDD and desktop/mobile site CI: [#44855747078 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44855747078).
- Core CI: [#44855747033 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44855747033).
- Public website HTTPS/hash/api GET+POST/desktop+mobile chromium: [#44855747071 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44855747071); [screenshots #14687635885](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44855747071/artifacts/14687635885).
- Vercel Project update for Ignored Build Step accepted. Exact readback/behavior still unverified, so this configuration is not yet claimed as tested effective.
- Production deploy for feature commit `4c884dd` FAILED with HTTP 402 `api-deployments-free-per-day`, `retryAfter=86400`. Last confirmed READY was docs-only `e617f686`; unchanged HTML public E2E does not prove source provenance.
- Submitted 16; Accepted 14/100; Failed R001; **R016 PENDING**. No account-scoped durable PostgreSQL API has been deployed or tested with real users.

## Next acceptance action
After quota recovers, trigger the exact latest feature-containing `main` SHA and verify Vercel READY, link, public unauthenticated HTTPS 200 and desktop/mobile Chrome plus negative API tests; also prove docs-only skip with Vercel build logs. Do not credit R016 before those gates. Then begin durable authenticated PostgreSQL PAPER ownership and available/locked balances, with no real funds or private keys.


## Final R016 acceptance (2026-11-21)
**R016 Accepted retroactively. Total Submitted 22, Accepted 21/100, Failed R001, Pending 0.**
- The ignored build step `node deployment-gate.cjs` was actually invoked for a documentation-only `main` commit `0bca41dd`. [Vercel deployment evidence](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/47nMThsWa8kronnsk4EGCNUx12eV) and build logs show `Atlas PAPER release gate: documentation-only commit => SKIP`, then `CANCELED` explicitly because Ignored Build Step returned 0. This is the **expected skip**, not a failed site deployment.
- The same release gate implementation is included in code-bearing [main SHA 499bfa77](https://github.com/twappleon/Crypto-Trading-Platform/commit/499bfa77bf4055195301259c392c797a52731548), [Vercel Production READY](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/3JWMZNBCEACnEJEBZmiwpn3vF5JN), [Site/PostgreSQL/desktop/mobile CI SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794213), [Core BDD SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794257), [public HTTPS/hash/API negative/Chromium SUCCESS attempt 2](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794182/attempts/2), [public screenshot artifact](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44884794182/artifacts/14699491503).
- Original R016 negative tests and source are preserved in [merged PR #8](https://github.com/twappleon/Crypto-Trading-Platform/pull/8). Do not double-count as a fresh round. Public terminal still browser-only simulation.
