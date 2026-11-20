# Round 013 — offline synthetic order history export

Date: 2026-11-21 | Source: `feat/round-013-paper-history-export-20261121` | Mode: **PAPER / SANDBOX ONLY**.

## Actual source modification
`web/index.html` (v0.6 candidate) provides user-clicked JSON download from volatile browser order history: id, side, integer USDC cents, BTC micro-units, and OPEN/CANCELED. The payload declares `PAPER_BROWSER_ONLY`, `volatile_memory`, `synthetic: true`, and `executions: 0`. Empty history/reset cannot export stale records. No REST, cookies, network calls, localStorage, KYC, wallets, order matching or transaction persistence.

## Executable test changes
`web/site-smoke.test.cjs` verifies the offline/zero-execution markers; `web/site-interaction.test.cjs` verifies empty-state denial, exact scaled amounts, canceled state and reset; `web/site-browser.test.cjs` verifies actual JSON download on desktop/390px mobile and existing order/cancel/overdraft/safety guards.

## Acceptance
**PENDING / NO** at source submission: no claim of GitHub CI, Vercel deployment or public browser evidence until verified on the final SHA. Baseline Submitted 12 / Accepted 11 / Failed 1. R013 submission makes Submitted 13 / Accepted 11 / Failed 1 / Pending 1.

## Release gates
1. Source branch and PR CI: Node smoke/DOM negative cases + Playwright Chromium desktop/mobile must pass.
2. Merge to `main`; GitHub Actions must pass for the resulting exact SHA.
3. Vercel Production READY from the matching `main` source commit, public URL HTTPS 200, HTML hash equality, and logged-out browser E2E/download/screenshot evidence.
4. Only then set Accepted=12/100; otherwise keep R013 pending and report blocker.

Public demo: https://crypto-trading-platform-demo.vercel.app/ ; Source: https://github.com/twappleon/Crypto-Trading-Platform ; Actions: https://github.com/twappleon/Crypto-Trading-Platform/actions ; P0 status: https://github.com/twappleon/Crypto-Trading-Platform/blob/main/docs/PROGRESS.md
