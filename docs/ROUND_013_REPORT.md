# Round 013 — offline synthetic order history export

Date: 2026-11-21 | Source: `feat/round-013-paper-history-export-20261121` | Mode: **PAPER / SANDBOX ONLY**.

## Actual source modification
`web/index.html` (v0.6 candidate) provides user-clicked JSON download from volatile browser order history: id, side, integer USDC cents, BTC micro-units, and OPEN/CANCELED. The payload declares `PAPER_BROWSER_ONLY`, `volatile_memory`, `synthetic: true`, and `executions: 0`. Empty history/reset cannot export stale records. No REST, cookies, network calls, localStorage, KYC, wallets, order matching or transaction persistence.

## Executable test changes
`web/site-smoke.test.cjs` verifies the offline/zero-execution markers; `web/site-interaction.test.cjs` verifies empty-state denial, exact scaled amounts, canceled state and reset; `web/site-browser.test.cjs` verifies actual JSON download on desktop/390px mobile and existing order/cancel/overdraft/safety guards.

## Acceptance
**ACCEPTED / YES** after branch source/negative BDD PASS and final source release SHA `0c1578f7a2a6e538b5f85a2b61a00b06d129a011` reached Vercel Production READY and passed GitHub public HTTPS/Chromium desktop/mobile hash and interaction checks. Final accounting Submitted 13 / Accepted 12/100 / Failed R001 / Pending 0.

## Release gates
1. Source branch and PR CI: Node smoke/DOM negative cases + Playwright Chromium desktop/mobile must pass.
2. Merge to `main`; GitHub Actions must pass for the resulting exact SHA.
3. Vercel Production READY from the matching `main` source commit, public URL HTTPS 200, HTML hash equality, and logged-out browser E2E/download/screenshot evidence.
4. Only then set Accepted=12/100; otherwise keep R013 pending and report blocker.

Public demo: https://crypto-trading-platform-demo.vercel.app/ ; Source: https://github.com/twappleon/Crypto-Trading-Platform ; Actions: https://github.com/twappleon/Crypto-Trading-Platform/actions ; P0 status: https://github.com/twappleon/Crypto-Trading-Platform/blob/main/docs/PROGRESS.md

## Round 013 verification evidence
- [Merged PR #5](https://github.com/twappleon/Crypto-Trading-Platform/pull/5), [site BDD + real browser CI PASS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44836991383), [Core BDD main SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837163289).
- [Main feature/release-fix SHA 0c1578f7](https://github.com/twappleon/Crypto-Trading-Platform/commit/0c1578f7a2a6e538b5f85a2b61a00b06d129a011) → [Vercel Production READY](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/7vYoVirpEotijvkVhdBZRA9eTS2L) (`githubCommitRef=main`, exact `githubCommitSha`). Production URL: https://crypto-trading-platform-demo.vercel.app/.
- [Public logged-out HTTPS 200/source SHA-256/actual Chromium desktop 1366px & mobile 390px E2E SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837166478); [screenshot artifact ID 14678557644](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44837166478/artifacts/14678557644). Both real browser paths verified exported synthetic history JSON and negative order behavior.
- Initial public gate for `284b621` failed due to stale `Prototype v0.5` marker in the verification test. Fixed as `0c1578f` and the exact-source gate passed **before** acceptance. No real orders/funding or persistence.
