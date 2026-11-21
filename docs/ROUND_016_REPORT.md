# Round 016 — PAPER website release reliability
Date: 2026-11-21
Status: Submitted / Pending independent GitHub CI + Vercel Production verification

## Source change
- `web/deployment-gate.cjs`: conservative Vercel Ignored Build Step. Verified docs-only updates skip a production build; any `web/**` or root `vercel.json` change builds. Git errors, SHA option injection, unexpected context, explicit force build all trigger BUILD, never silent skip.
- `web/deployment-gate.test.cjs`: independent Node negative BDD for source vs docs changes, shallow Git history, malformed SHA, environment/branch and force override.
- `.github/workflows/site.yml` runs the new BDD before browser regression.
- Vercel project target `crypto-trading-platform-demo`, GitHub `main`, root `web`, production URL https://crypto-trading-platform-demo.vercel.app/

## Acceptance gate (not yet claimed)
- [ ] Source and Core GitHub Actions SUCCESS on exact SHA
- [ ] Vercel configuration confirmed with `node deployment-gate.cjs`
- [ ] Vercel Production READY at the feature-containing `main` SHA
- [ ] Public HTTPS 200 + exact HTML hash + diagnostic GET 200/POST 405 + desktop/mobile browser E2E + screenshot artifact
- [ ] Update `docs/PROGRESS.md` with final proof without double-counting R016.

## Safety and next P0
The public website remains browser-only synthetic PAPER data; none of this work installs or enables a live trading backend. Next R017 target is account-scoped authenticated durable PostgreSQL paper order and hold API with isolation, idempotency and reconcilable transaction tests. Never collect customer KYC, actual wallet keys or real assets.
