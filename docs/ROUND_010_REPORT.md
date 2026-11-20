# Round 010 — website-first paper terminal safety (submission)
Date: 2026-11-21 (Asia/Phnom_Penh)
Status: **SUBMITTED / NOT ACCEPTED**. Existing accepted backend rounds remain 7/100. The public Vercel release gate must pass before this website milestone can be accepted.

## Functional source change
- `web/index.html`: visible **Cancel all open demo orders** control; convert only currently open orders to CANCELED history, remove reservations in one local state update and re-render available/locked synthetic USDC/BTC balances.
- Preserve browser-lifetime order IDs across Reset so a retained stale Cancel button from an earlier reset cannot cancel a new synthetic order whose ID was recycled. Reset still clears all visible demo balances, order history and orders.
- Visible release marker v0.3. No new network calls, credentials, asset custody, execution, KYC, deposits, withdrawals or persistence.

## Executed CI on exact source/test SHA
- [Website smoke + interaction BDD SUCCESS — PR run 44811445804](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811445804), head `4041e6bf9d081bc685c7e16a70e9b5c6809def40`.
- [Core JDK BDD SUCCESS — PR run 44811445593](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811445593), same head. Legacy `Map.of.containsValue(null)` NPE on `main` was fixed with null-safe validation and negative regression scenario. Previous red core CI was investigated from actual job logs.
- The site is **still not Accepted** because no Vercel production URL exists.

## BDD and independent checks
- `node web/site-smoke.test.cjs`: assert cancel-all control exists, open-only batch selection, and reset no longer recycles session IDs.
- `node web/site-interaction.test.cjs`: assert old cancellation handler after reset cannot remove or unlock new order; BUY+SELL multi-cancel restores BOTH assets; repeated empty cancel-all does not mutate history/balances.
- GitHub Actions `.github/workflows/site.yml` runs both scripts on PR and push. Exact PR SHA and run status must be verified separately.
- Browser/HTTP screenshot and iPhone-width E2E: BLOCKED until Vercel production has a READY deployment URL. No screenshots or HTTP 200 claims without observation.

## Known release gate / next step
- Vercel `crypto-trading-platform-demo` still showed `live=false`, zero deployments and no domain at run start. Previous production deploy was rejected with 402 daily deployment quota; retry on 2026-11-21 again returned HTTP 402 `api-deployments-free-per-day` with `retryAfter=86400`; team/project protection is off. No mapped CLI credential fallback was available. This is a transient quota, not code readiness.
- Push tested changes through PR to `main` only after a green CI, then deploy `main:web` to Vercel Production, verify public HTTPS without authentication and perform desktop/mobile order/cancel/reset checks. Until all release gates pass, do not increment Accepted.
- This is entirely local browser state; no PostgreSQL integration is claimed.

## Browser E2E code added
- `web/site-browser.test.cjs` now runs a **real headless Chromium** (not just VM) at desktop 1366×768 and iPhone-like 390×844. Checks include 200 response, safety labeling, synthetic buy/sell reserve, insufficient funds, stale detached cancel handler, Cancel All, repeated no-op, reload, external traffic, no horizontal overflow and screenshot capture.
- `.github/workflows/site.yml` installs Playwright Chromium, runs test after Node VM BDD and uploads `artifacts/site-desktop.png`, `artifacts/site-mobile.png` as a GitHub Actions artifact. Public URL can be tested with `SITE_URL=https://... node web/site-browser.test.cjs` **only after HTTPS exists**.
- CI status for this new browser E2E and screenshots must be verified before counting any tests as passed. Do not confuse locally hosted browser HTTP 200 with a public Vercel HTTPS check.
