# Round 015 — visible read-only PAPER API status and fail-closed browser diagnosis
Date: 2026-11-21. Branch: feat/round-015-visible-paper-api-status-20261121. **SUBMITTED / PENDING (not Accepted)**.

## Material source changes
- Public terminal v0.8 now offers a user-initiated same-origin read-only GET of `/api/paper-status`; sends no cookie credentials, forbids redirects, requests no-store JSON.
- The only accepted diagnostic is explicitly PAPER_SANDBOX / NOT_READY / BROWSER_MEMORY_ONLY, all persistence/auth/order/live-funds flags false. Malformed/HTML/503/network errors and false READY reports are labeled unavailable or unverified, **never** enabling real trade or durable funds. Sequence ID fences stale responses from rewriting a newer failure.
- New `web/paper-status-ui.test.cjs` verifies exact method/path/options, hostile forged READY/markup, bad content type, failed network and delayed stale success, preserving demo money. CI now runs it with existing site smoke, API negative suite, and Playwright desktop/mobile. Public release gate checks GET=200 and POST=405.

## Accounting and release blockers
**Submitted 15 / Accepted 12 of 100 / Failed R001 / Pending R014 and R015.** This branch is not a deployed, persistent exchange. Final acceptance requires verified source/main Site+Core CI, Vercel Production READY from exact main SHA, public HTTPS 200 + HTML hash, live read-only API GET 200/POST 405 and real desktop/390px mobile Chromium screenshot artifacts. Previous R014 remained blocked by Vercel free daily deployment quota HTTP 402; do not claim live R015 until a new READY record and public tests exist.

## Safety and next work
Synthetic browser session orders remain only OPEN/CANCELED, not filled; reload resets all. No deposits, withdrawals, KYC, wallet keys, live quotes or real money. Next: clear release proof, then build authenticated/account-isolated durable PostgreSQL PAPER API with reconciliation/replay and fail-closed E2E.
