# Main site release — P0
Source: web/index.html on main. Standalone responsive static demo (English).
Site functions: synthetic BTC/USDC chart and depth, local limit-buy/limit-sell validation, available/held demo balances, order cancellation/reset.
**Limitations:** orders are not executed, not durable, not linked to Java/PostgreSQL backend; no real accounts, KYC, deposits, withdrawals or crypto transfers. This is not an exchange.
CI: .github/workflows/site.yml. Validate HTTPS response, accessibility, desktop/mobile and manually run an order, reject overdraw, cancel, reset on the actual deployment after Vercel quota is lifted.
Vercel: project crypto-trading-platform-demo (prj_JESXfEsbUcjI6dA6Yoe3VfcV8iPf), GitHub linked, root web, production main.
Blocking issue 2026-11-21: first deploy returned HTTP 402 api-deployments-free-per-day (daily limit 100), retryAfter 86400 seconds. **Do not claim production published or live verified** until deployment is READY and actual URL is opened.
Acceptance: site updates will not count as accepted 100-round milestones without green GitHub CI and HTTPS/manual E2E evidence.
