# Round 012 — exact browser-only collateral preview

Date: 2026-11-21 · Mode: PAPER/SANDBOX only.

## Actual feature and tests submitted
- `web/index.html`: pre-submit demo available funds and reserve preview, using checked integer cents/micro-BTC, same conservative BUY quote ceil used by reserve. Re-renders when input, side, order, cancel, cancel-all or reset changes, including insufficiency before submit. Clear local-only label.
- `web/site-interaction.test.cjs`: negative BDD for 0.07 synthetic USDC hold, zero-available overbooking, selling excess BTC, invalid exponent, repeated release. `web/site-browser.test.cjs` asserts preview in both desktop and 390px Chromium. `web/site-smoke.test.cjs` and release marker updated to v0.5.
- No external APIs, network trades, storage, wallet/KYC, custody, private keys or order fills.

## Gate and status
Initially Pending. **Now ACCEPTED** because R012 source was merged to main as `ed8478b`, green Site/Core CI completed, Vercel Production READY records this exact main source SHA, and the public URL passed HTTP/hash/Chromium desktop/mobile screenshot E2E. Overall accounting **11/100 Accepted** (R009–R012 pending gates also resolved), Failed R001 remains excluded. All links and status must be appended after verification, not presumed.

## Next
Retry exact-main Production when quota allows, validate the user-facing URL and prevent release gate false positives. Continue authenticated persistent PAPER-only backend work separately, never pretending local UI orders are durable.

## Final verification links (2026-11-21)
- [PR #4 merged](https://github.com/twappleon/Crypto-Trading-Platform/pull/4); [exact source SHA ed8478b](https://github.com/twappleon/Crypto-Trading-Platform/commit/ed8478b90655a14bbf6b783828073b73cf271afa).
- [Site CI SUCCESS #44828632082](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44828632082); [Core BDD SUCCESS #44828632423](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44828632423).
- [Vercel Production READY dpl_D8gz7J2s](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/D8gz7J2sRtXf6UjXKqumLzqVMLNv), git ref main / SHA ed8478b, public alias `https://crypto-trading-platform-demo.vercel.app/`.
- [GitHub public release #44828632196 attempt 2 SUCCESS](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44828632196/attempts/2), unauthenticated HTTPS HTTP 200, matching HTML bytes, actual desktop + 390px mobile Chromium regression, screenshot artifact ID **14674554232**. Earlier attempt raced with alias propagation and failed; rerun succeeded after READY.
- R009 history, R010 cancel-all, R011 cent rounding and R012 live risk preview have independent source/BDD and are all present and tested in the released site. Submitted 12 / Accepted 11 / Failed 1 / Pending 0. Still **PAPER-ONLY browser simulation**, not financial custody or persistent trading.
