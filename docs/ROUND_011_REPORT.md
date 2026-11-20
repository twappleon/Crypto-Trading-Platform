# Round 011 — integer-safe PAPER reservations and source-provenance recovery

Date: 2026-11-21. Mode: educational PAPER/SANDBOX only; no deposits, private keys, chain calls or KYC.

## Actual submitted change
- `web/index.html` v0.4 validates decimal price/quantity as scaled BigInt; BUY quote reservations round UP to integer USDC cents, SELL uses integer 0.000001 BTC units. Available and locked synthetic balances are computed from integer reserves.
- Added negative BDD for 64275.01 × 0.000001 => 0.07 synthetic USDC hold; sub-cent 0.01 reserve; exponent input rejection; fully locked account rejecting another tiny order; complete cancel/cancel-all release.
- Desktop/mobile real Chromium browser suite checks 0.07 hold and 99999.93 available, v0.4 marker; public HTTPS checker requires byte-for-byte HTML match.
- README, PRD, BDD, PROGRESS, SITE_RELEASE and CI artifact name updated.

## Production release checkpoint
Previous v0.3 source `77b061928b7731cd08eda9dbfc6fe0f5b18cd453` now has Vercel Production READY deployment `dpl_4ymvDQTGJyPiBc2X698SDWwCFZZ6` with githubCommitRef=main, githubCommitSha exactly matching source, and public site alias. That does not yet prove v0.4 is live.

## Acceptance
Round 011 Submitted. Accepted **NO/PENDING** until GitHub Actions CI pass, PR merged, new production READY matches exact merged main SHA, and public unauthenticated HTTPS 200 / source HTML hash / desktop & 390px mobile Chromium tests all pass. Maintain Accepted=7/100 until all gates. The website is still only local synthetic simulation; PostgreSQL backend PR is not connected.

## Next
Resolve production SHA after merge, retest public link, update evidence; then safely integrate authenticated paper-only PostgreSQL backend without mixing browser session state with durable ledger state.

## Verified delivery status (2026-11-21, this run)
- [PR #3](https://github.com/twappleon/Crypto-Trading-Platform/pull/3) merged into main at [a9b5eab4db5a14f11833b5a14dfdb137b8eac2fa](https://github.com/twappleon/Crypto-Trading-Platform/commit/a9b5eab4db5a14f11833b5a14dfdb137b8eac2fa).
- PR source [fdd22b01a609928100af02a5cb9abc5276491bf7](https://github.com/twappleon/Crypto-Trading-Platform/commit/fdd22b01a609928100af02a5cb9abc5276491bf7) passed [Paper Site Smoke #44820788414](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44820788414) (Node standalone/static + real Chromium desktop/mobile with screenshot artifact), and [Core BDD #44820788884](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44820788884). Initial [Site CI #44820715019](https://github.com/twappleon/Crypto-Trading-Platform/actions/runs/44820715019) failed because static marker changed, corrected in fdd22b0 and rerun green. Vercel PR status indicates deployment build rate limit, not a passing Production check.
- Prior v0.3 [Production deployment](https://vercel.com/twappleons-projects/crypto-trading-platform-demo/4ymvDQTGJyPiBc2X698SDWwCFZZ6) is READY, ref=main, SHA=77b0619, primary public alias. **R011 v0.4 Production deployment attempt for a9b5eab received HTTP 402** `api-deployments-free-per-day`, retryAfter 86400. Some earlier branch preview deployments exist, but they are not exact merged-main Production releases. Therefore public v0.4 and production-SHA/browser gate remain **NOT VERIFIED**, and Accepted remains 7/100.
- Next: retry a9b5eab-or-later main Production when Vercel quota allows, validate READY git SHA and production alias, run public CI HTTPS/desktop/mobile on exact deployed source, then update acceptance ledger. No live trading.
