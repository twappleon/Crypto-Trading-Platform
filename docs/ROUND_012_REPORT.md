# Round 012 — exact browser-only collateral preview

Date: 2026-11-21 · Mode: PAPER/SANDBOX only.

## Actual feature and tests submitted
- `web/index.html`: pre-submit demo available funds and reserve preview, using checked integer cents/micro-BTC, same conservative BUY quote ceil used by reserve. Re-renders when input, side, order, cancel, cancel-all or reset changes, including insufficiency before submit. Clear local-only label.
- `web/site-interaction.test.cjs`: negative BDD for 0.07 synthetic USDC hold, zero-available overbooking, selling excess BTC, invalid exponent, repeated release. `web/site-browser.test.cjs` asserts preview in both desktop and 390px Chromium. `web/site-smoke.test.cjs` and release marker updated to v0.5.
- No external APIs, network trades, storage, wallet/KYC, custody, private keys or order fills.

## Gate and status
Submitted, **NOT Accepted** until GitHub actions are green for source and merged main, a Vercel READY Production deployment records exact current main SHA, and public HTTPS and Chromium tests (desktop and phone) pass with artifacts. Historical accounting stays **7/100 Accepted**; pending R009–R012. All links and status must be appended after verification, not presumed.

## Next
Retry exact-main Production when quota allows, validate the user-facing URL and prevent release gate false positives. Continue authenticated persistent PAPER-only backend work separately, never pretending local UI orders are durable.
