# P0 main-site release — PAPER/SANDBOX only

## Current state (2026-11-21, Round 009 submitted, NOT Accepted)
- GitHub production source: `main:web/`; Vercel project `crypto-trading-platform-demo` (`prj_JESXfEsbUcjI6dA6Yoe3VfcV8iPf`) is connected to `twappleon/Crypto-Trading-Platform`.
- Main-site code is pushed, including v0.2 visible footer, session order history, OPEN/CANCELED statuses, local synthetic quote/base reservation, explicit fabricated depth/chart and responsive layout. **There is no external order execution and no server persistence.**
- Vercel project configuration checked and set: root directory `web`, framework auto/static, no SSO or password protection. Public release would not require login after a successful deployment.
- **Release BLOCKED:** production deployment request on 2026-11-21 returned **HTTP 402** `api-deployments-free-per-day` with `retryAfter=86400`. Vercel reports `live=false`, zero deploy records and no published domains. The working environment has no mapped Vercel CLI fallback.
- No public production URL exists to verify. **No claim of HTTP 200, mobile browser E2E, or live READY deployment is made.**
- Safety: prices/order-book levels fabricated; order statuses only OPEN / CANCELED, no FILLED/settlement, no accounts/real balances, KYC data, custody, deposit, withdrawals, network requests or localStorage.
- Latest meaningful UI source commit: [7108cbb](https://github.com/twappleon/Crypto-Trading-Platform/commit/7108cbb0a875c71e151a620ab16b264ea051e678). [Site source](../web/index.html).
- BDD source: [interaction test](../web/site-interaction.test.cjs) and [static smoke](../web/site-smoke.test.cjs); [Actions](https://github.com/twappleon/Crypto-Trading-Platform/actions/workflows/site.yml).
- Test evidence this run: exact checked-in `web/site-interaction.test.cjs` was executed using an isolated V8 Node-API shim (39 behavioral assertion checks PASS), plus seven additional static guards (46 combined PASS). An independent 9-assertion UI check and ten-marker static scan also passed; this is not a substitute for the GitHub Actions Node job or published HTTPS browser E2E. **GitHub Actions SUCCESS on the latest commit is not independently confirmed.**
- Do not count the site work among 100 Accepted rounds until BOTH GitHub CI on exact source/deployment SHA is green and public HTTPS/desktop/mobile browser E2E is witnessed.

## Required next verification when Vercel quota clears
1. Request Production deployment from GitHub `main` with `web` as root; capture deployment ID, target URL, READY/ERROR and the exact SHA.
2. Open the **actual published URL** in a logged-out browser. Verify HTTPS 200, `Prototype v0.2`, PAPER/SANDBOX and synthetic data notice; capture visible screenshot.
3. At desktop and iPhone-like mobile width, buy 1 BTC @ 64275, verify available USDC 35,725 and locked 64,275; reject an overdraft; cancel, verify full release and CANCELED history; place SELL 1.5 BTC, verify available 0.5 and locked 1.5 BTC; reset and verify clean session.
4. Check no network order submission, no real KYC/custody, no claims of fills. Reload should reset all nonpersistent state; browser local sandbox does not talk to the PostgreSQL branch prototype.
5. Record final SHA, CI run URL, production URL, HTTP/browser evidence and Accepted decision in [PROGRESS](PROGRESS.md). Keep count unchanged if any gate fails.

Do not substitute the GitHub source link for a public deployed site URL.

## Round 010 site release verification (2026-11-21)
- Source/test PR branch: [PR #2](https://github.com/twappleon/Crypto-Trading-Platform/pull/2). Exact feature SHA [4041e6b](https://github.com/twappleon/Crypto-Trading-Platform/commit/4041e6bf9d081bc685c7e16a70e9b5c6809def40).
- Green PR [Site smoke+VM interaction BDD](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811445804) and [Core JDK BDD](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44811445593) verified for 4041e6b. Baseline main Java NPE repaired with negative test in the PR.
- Repeat Vercel production deploy request to project `prj_JESXfEsbUcjI6dA6Yoe3VfcV8iPf` via authorized account again returned HTTP **402** `api-deployments-free-per-day`, retryAfter 86400 seconds. Current project `live=false`, zero deployments/domains, no public site to inspect. A local Vercel CLI/auth fallback was not available.
- R010 remains NOT Accepted. Do not turn CI success into an invented deployed URL, HTTP 200, mobile screenshot or exchange readiness.
