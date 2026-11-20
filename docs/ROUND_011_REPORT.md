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
