# BDD Acceptance — Round 001
Run `bash run-tests.sh`.
Given seller posts 2 @ 100, when buyer posts 1.5 @ 101, then maker price 100 and seller retains 0.5.
Given same price and two resting orders, when opposite crosses, then oldest fills first.
Given a stranger, when canceling another user's order, then reject.
Given owner, when canceling a live order, then remove resting order.
Given nonpositive price/quantity, when submitting, then reject.
Given same owner on both sides, when crossing, then reject before mutating earlier fills.
Given test-funding and transfer, when ledger posts, then per-asset debits equal credits.
Given duplicate journal ID and same payload, when repeated, then balance unchanged.
Given duplicate journal ID and different payload, when repeated, then reject.
Given insufficient funds, when transferring, then balance unchanged.
Given unbalanced journal, when posting, then reject.
Known limitations: in-memory only, no reservation/settlement coupling, no persistence/replay, no real deposits. Not production finance code.


## Main-site P0 — paper-only session order lifecycle (2026-11-21)
Run locally using Node.js 22:
```sh
node web/site-smoke.test.cjs
node web/site-interaction.test.cjs
```
CI: `.github/workflows/site.yml` must execute both tests on the `main` commit.
- Given an initial 100,000 synthetic USDC and 2 BTC, then the first render displays both available balances and zero session orders.
- Given a BUY limit for 1 BTC @ 64275 USDC, when submitted, then 64,275 synthetic USDC is locked, available is 35,725, and the session history shows OPEN.
- Given insufficient remaining quote funds, when a second BUY is attempted, then it is rejected and history/order counts remain unchanged.
- Given an OPEN order, when it is canceled, then the reserve is released exactly once, open count becomes zero, and session history shows CANCELED (not FILLED).
- Given a stale cancel handler, when fired again, then it does not change balance/history.
- Given a SELL order exceeding the synthetic BTC balance, then reject without recording a history item.
- Given a SELL for 1.5 BTC, then reserve base asset, reduce available to 0.5 BTC, and display OPEN status in session history.
- Given invalid zero price, quantity precision >6 places or a nonnumeric input, then reject without modifying the order book.
- Given reset, then restore original synthetic balances, clear open orders and session history.
- Do **not** show any executed, settled, or persisted status: open/canceled events are browser-memory-only, never sent to any server.
- Static gate checks explicit synthetic/data warnings, responsive CSS, and absence of network or storage APIs.

**External release gate:** Vercel Production READY, public HTTPS reachable without authentication, browser order/cancel/reset verified at desktop and mobile widths; until then this site milestone remains PENDING and does not count toward Accepted/100.

## Round 010 — public terminal cancellation safety
Run `node web/site-smoke.test.cjs` and `node web/site-interaction.test.cjs`.
- Given an old cancel button for order #1, when resetting a browser session and submitting a new order, clicking that stale button must **not** cancel the new order or release its locked synthetic collateral. Browser-lifetime order IDs must not be recycled.
- Given two open demo orders (one BUY and one SELL), when `Cancel all open demo orders` is clicked, then both open orders disappear, CANCELED history entries remain, and both synthetic asset reserves release exactly once.
- Given no open orders, when `Cancel all` is repeated, then balances and order history remain unchanged.
- Given `Reset`, the visible order history and balances clear but the in-memory next-order ID must remain unique for stale DOM event safety.
- These Node VM checks are **not** proof of production browser interactions. External public HTTPS desktop/mobile browser E2E and a green GitHub CI are separately required for Accepted.

### Live Chromium desktop/mobile BDD gate
Run `npm install --no-save --no-package-lock playwright@1.64.1`, `npx playwright install --with-deps chromium`, then `node web/site-browser.test.cjs`. CI `Paper Site Smoke` must execute this in 1366×768 desktop and 390×844 mobile Chromium, producing screenshot artifacts. It must verify HTTP 200 from locally served static page, PAPER/SANDBOX and synthetic data labels, correct BUY reserves, overdraft rejection, stale detached Cancel handler after Reset, SELL reserves, Cancel All of both assets, repeat action idempotency, no cross-origin requests, reload resets and no horizontal overflow. Optional `SITE_URL` points the same script to a REAL public URL. Local HTTP screenshots DO NOT count as published production HTTP/browser E2E; a READY Vercel Production URL must be tested separately.

## Round 011 — exact paper hold precision and release provenance
Run `node web/site-smoke.test.cjs`, `node web/site-interaction.test.cjs` and `node web/site-browser.test.cjs`; on the publicly deployed exact source run `node web/site-public-verify.cjs` and `SITE_URL=https://crypto-trading-platform-demo.vercel.app/ node web/site-browser.test.cjs`.
- Given BUY price 64275.01 and quantity 0.000001, the exact cost 0.06427501 synthetic USDC reserves **0.07** (ceil), available decreases by 0.07, Cancel restores the exact amount.
- Given BUY price 0.01 and quantity 0.000001, a sub-cent notional still reserves **0.01** in the educational simulator, never a displayed 0.00 lock.
- Given a BUY that locks the entire 100000.00 USDC starting wallet, placing even a tiny additional order is rejected; open order count does not change.
- Exponential input `1e-6`, excess decimal places, invalid price/amount, and overlarge values are rejected with no new order.
- Given an accepted SELL, BTC reserve uses exact integer 0.000001 units. A repeated cancel or cancel-all cannot double-release synthetic collateral.
- In real Chromium on both 1366px desktop and 390px mobile, verify v0.4 marker, 0.07 hold, 99999.93 available and complete release, plus existing reset, stale-button, and network-isolation checks.
- **Release acceptance:** production target READY, git ref=main, githubCommitSha matches release source SHA, public HTTP 200, same-HTML hash, public Chromium BDD and Site/Core GitHub CI SUCCESS. If any fail, keep Round 011 pending.

## Round 012 — exact reserve preview / negative BDD
Run `node web/site-smoke.test.cjs && node web/site-interaction.test.cjs` and real Chromium `node web/site-browser.test.cjs`. All remain offline PAPER/SANDBOX.
- Given BUY 64275.01 x 0.000001 BTC, the preview shows **Hold 0.07 USDC** and **Available 100,000.00 USDC**, matching the integer-cent reservation after submitting.
- Given a fully held synthetic USDC account, a subsequent BUY shows **Insufficient demo balance** before submit and clicking submit still fails without balance/history change.
- Given SELL 1.500001 BTC, preview reserves exactly **1.500001 BTC** and shows **Available 2.000000 BTC**; SELL 2.000001 must warn before submit.
- Given negative, exponent, >2-price-decimal, >6-quantity-decimal or oversized amount, preview must NOT describe the input as a valid order; submit must still reject.
- Given Cancel / Cancel All / Reset, the preview refreshes without duplicating credits. Repeated Cancel All and detached historical Cancel buttons must not restore more than originally reserved.
- The preview is explicitly **browser-only**. No external calls, storage APIs, or claims of actual market quotes, real fills or persistence may appear.
- Acceptance additionally requires green GitHub Site + Core CI, merged `main`, Vercel Production READY with exactly that `main` commit SHA, HTTP 200 and matching public HTML hash, and public desktop/mobile Chromium with screenshots. Otherwise the round remains Pending.

## Round 013 — local paper history JSON export and negative BDD
- Given no browser-session orders, when clicking **Export local demo history**, show an empty-state message and do not create/download a file.
- Given a local BUY @64275 qty 1, when exporting, provide an offline `atlas-paper-session.json` file with `PAPER_BROWSER_ONLY`, `volatile_memory`, `synthetic=true`, `executions=0`, exact integer `priceCents=6427500`, `quantityMicroBTC=1000000`, `status=OPEN`; never claim server persistence or execution.
- Given a canceled order, when exporting, it remains in the history with `CANCELED` (not a fabricated fill). Repeated cancellation cannot change funds or history.
- Given reset, when exporting again, no previous orders can be downloaded; an earlier file remains a historical synthetic snapshot only.
- Given corrupted/adversarial price or overprecision/exponent input, the order must be rejected before it enters the snapshot, no wallet/KYC/private-key fields exported and no cross-origin requests made.
- Run `node web/site-smoke.test.cjs`, `node web/site-interaction.test.cjs`, `node web/site-browser.test.cjs` on desktop and 390px mobile. Require same-source public HTTPS validation, site/Core CI green and Vercel Production READY before Accepted.

## Round 014 — API readiness + negative mutation BDD
Run `node web/paper-status.test.cjs`, `node web/site-smoke.test.cjs`, `node web/site-interaction.test.cjs`, desktop/mobile `node web/site-browser.test.cjs` and exact deployed `node web/site-public-verify.cjs` + `SITE_URL=https://crypto-trading-platform-demo.vercel.app/ node web/site-browser.test.cjs`.
- GET paper-status = 200 no-store JSON, mode PAPER_SANDBOX, readiness NOT_READY, durablePostgresConnected false, publicAuthenticatedApi false, orderEntryEnabled false, synthetic true; never reflects cookies, credentials, private keys, request body or query string.
- HEAD body empty; POST, PUT, PATCH, DELETE and OPTIONS with hostile order/funds/keys bodies all 405 without mutation or cross-origin permission.
- Website explicitly shows BROWSER MEMORY ONLY and same-origin JSON status link. It continues performing all order operations in volatile JS, without sending funds to the API.
- Real desktop 1366px + mobile 390px browser must verify GET/POST safety, session trade/cancel/reset/JSON export, no outside traffic, no overflow, screenshotted public HTTPS. Production must be READY at exact main SHA and HTML hash; otherwise R014 Pending.


## R015 — visible API diagnostic BDD (P0, pending)
Run \`node web/paper-status-ui.test.cjs\` plus smoke/interaction/API tests, local desktop/mobile Chromium and, after Vercel READY, the public release gate.
- Given the public NOT_READY read-only GET contract, clicking Check paper API connection displays a truthful NOT_READY result without authenticating or persisting an order.
- Given unexpected READY, changed capability flags, injected markup, HTML instead of JSON, HTTP 503 or network failure, the terminal refuses to infer server-backed storage or expose remote order submission.
- Given two in-flight requests, an earlier successful result cannot overwrite a newer failure.
- Given API diagnostics, local orders and balances remain untouched; no cookies, stored tokens, or third-party URLs are transmitted.
- Production acceptance requires public status GET 200 and forbidden POST 405, exact deployed \`main\` SHA, public HTML hash, logged-out Chromium 1366x768 and 390x844 screenshots, green Site/Core CI. Branch-only tests never count as Accepted.
## Round 016 — Production deployment quota guard / negative BDD
Run `node web/deployment-gate.test.cjs` and the full website smoke/Chromium suite.
- Given `main` and a verified Git diff containing only documentation, then ignored-build exit 0 SKIPs duplicate Production work.
- Given any `web/` file or top-level `vercel.json` changed, then exit 1 BUILDS to keep the deployed site current.
- Given missing Git history, malformed SHA (including git option injection), unexpected Production branch, or unknown deployment environment, then exit 1 BUILDS rather than silently ignoring a user-visible update.
- Given an explicit ATLAS_FORCE_BUILD=1, then exit 1 BUILDS even with docs-only changes.
- This gate does not grant any real-money capability, PostgreSQL connectivity, or authentication. Verify public HTML and browser interactions independently.

## Round 017 — explicit browser-only synthetic fill, negative BDD
Run `node web/site-smoke.test.cjs` and `node web/site-interaction.test.cjs`; Site CI also runs `node web/site-browser.test.cjs` on desktop 1366px and mobile 390px.
- Given a fresh 100,000.00 synthetic USDC and 2.000000 BTC, when BUY @10 for 1.000000 BTC is reserved then the user selects **Simulate fill**, the session's synthetic total becomes USDC 99,990.00/BTC 3.000000, locked=0 and history SIMULATED_FILLED.
- Given SELL @10 for 1.000000 BTC, when manually simulated, total becomes USDC 100,010.00/BTC 1.000000, locked=0, history SIMULATED_FILLED.
- Given a completed synthetic fill, when a stale detached fill button is clicked again, totals and history do NOT change.
- Given a canceled order, clicking its former synthetic fill button does not credit funds or change CANCELED into SIMULATED_FILLED.
- Given a session export containing a manually simulated fill, it keeps `mode=PAPER_BROWSER_ONLY`, `storage=volatile_memory`, `executions=0` (no real executions) and `simulatedFills=1` with truthful status. Reset/reload erases it.
- Never use orders from remote APIs, customer balances, a real execution venue, live pricing, wallets or KYC. The status GET remains NOT_READY, public write attempts 405. No authenticated PostgreSQL persistence has been added by this round.
- R017 requires exact production source commit/READY, anonymous HTTPS 200 plus HTML hash and desktop/mobile public Chromium screenshot artifacts; otherwise **Pending**.

## Round 018 — signed read-only PostgreSQL PAPER balance boundary (standalone negative BDD)
Execute `node web/paper-balances.test.cjs` and include it in `site.yml`. Given a valid HMAC-SHA256 `v1` capability with permitted `paper:balances:read` scope, subject `alice` and expiry in the next hour, GET reads only `alice` from a parameterized `account_id=$1` SQL predicate with a repeatable-read read-only transaction. Exact total/locked/available decimal strings are returned; another valid subject cannot switch owner via URL/body. HEAD returns no body.
- Missing/tampered/wrong-signature, wrong scope, stale/overlong expiry, malicious account IDs and treasury tokens must all be 401 with **zero database access**.
- POST/PUT/PATCH/DELETE/OPTIONS must all be 405 before auth or DB access. Missing secret/database config is 503. Database failures and invalid negative numeric snapshots fail closed as generic 503 without reflecting secrets, SQL or request bodies.
- No CORS or caches; users cannot mint tokens in browser. Testing injected mock data is **not** actual PostgreSQL integration or a deployed persistent service. Public read/write E2E and isolated PostgreSQL integration are mandatory before R018 Accepted.

### Round 018 — real PostgreSQL + public HTTP execution gates
The mocked Node tests alone are insufficient. Execute `node qa/paper-balances.pg.test.cjs` against a **disposable PostgreSQL 16 CI service** with schema-compatible paper_ledger_accounts/holds. Given Alice=100 synthetic USDC with 30 active and 10 released held, return total 100/locked 30/available 70; given Bob=250 with 100 held, return total 250/locked 100/available 150. An untrusted account query/body must not read another owner. Subsequent separate-transaction Alice balance change must be reflected on authenticated repeat GET without changing Bob. No private funds, KYC or live orders. Exercise anonymous 401 and write 405.
Deploy main and run `node qa/paper-balances.public.test.cjs`: HTTPS anonymous GET must be 503 when unconfigured or 401 when configured, and POST must be 405 without accepting a body. A READY Vercel record and local/mock tests do not replace an actual public HTTP/browser acceptance gate.

## R019 — PostgreSQL PAPER snapshot conservation BDD
Given a signed, owner-scoped read-only paper capability, when the isolated PostgreSQL returns a complete BTC+USDC snapshot whose decimal total equals locked plus available in exact NUMERIC(38,18) units, then the endpoint returns 200 with only the allowlisted balance fields.
Given missing, duplicate, negative, over-precise, overflow, or mathematically inconsistent asset rows, when the API reads the snapshot, then it returns 503 PAPER_BALANCES_UNAVAILABLE without leaking data or claiming readiness.
Given production credentials are absent, unauthenticated requests or write methods are rejected without touching a real account or external exchange. The disposable PostgreSQL test MUST also corrupt an ACTIVE hold beyond the total and remove a BTC asset row for one user, observe 503 without data leakage, and verify restoration returns 200. Execute: node web/paper-balance-invariants.test.cjs; node web/paper-balances.test.cjs; node qa/paper-balances.pg.test.cjs (disposable CI PostgreSQL 16). Require Site+Core CI, exact SHA Vercel READY, public HTTPS and desktop/mobile Chromium before Accepted.

## R020 — durable PAPER hold / cancel negative BDD (server-only)
Run `node web/paper-reservations.test.cjs` for no-DB negative input cases. In isolated PostgreSQL 16 CI (after `qa/paper-balances.pg.test.cjs`) run `node qa/paper-reservations.pg.test.cjs`.
- Given Alice has 100 synthetic USDC, when reserving 30 with idempotency ID A, then locked is 30 and available 70 across separate transactions and the existing signed READ API.
- Given the same ID/owner/asset and semantically equal 30.00, when retried, no second hold is created; amount/owner mismatch is rejected. A canceled ID cannot be resurrected by retry.
- Given two PostgreSQL connections racing to reserve 50 each when only 70 remain, exactly one succeeds and available remains nonnegative; Bob's account remains unchanged.
- Given Bob tries to cancel Alice's ID, reject without mutation; Alice cancel releases exactly once and repeated cancel is idempotent.
- Given crash simulation via a rolled-back uncommitted hold, a new transaction sees no phantom hold.
- Given negative, exponential, wrong precision, zero, treasury owner, or invalid IDs, reject **before any database operation**.
- Do not expose write API, token issuance, persistent website order status, settlement, real funds, on-chain transfers or KYC. Production public site v1.0 must continue to display BROWSER MEMORY ONLY until genuinely connected. Require CI + Production SHA + HTTPS/mobile Chromium + screenshots before Accepted.

## R021 — PostgreSQL PAPER idempotent replay must serialize with cancellation
Run `node web/paper-reservations.test.cjs`, then `node qa/paper-reservations.pg.test.cjs` with the disposable PostgreSQL 16 service used in Site CI.
- Given an ACTIVE synthetic USDC hold with a trusted owner and exact replay payload, when the replay's first read sees ACTIVE but cancellation commits before the replay acquires the owner/asset row lock, then replay returns the **post-lock durable RELEASED state**, not stale ACTIVE.
- Given an in-flight cancellation transaction holds the account row lock, the replay must wait for that lock, re-read the hold and return RELEASED after commit; neither double-lock nor resurrect the released hold.
- Given a replay has mismatched owner, asset or amount, fail with IDEMPOTENCY_CONFLICT; a prior ID that disappears or has an unknown state must fail closed without new insertion.
- Invalid precision, treasury owner, unknown IDs and double-cancel retain the existing negative gates. Local deterministic mock and two actual PostgreSQL connections must both run; a fake-only test is not sufficient.
- Server-only code does **not** authorize public order writes, token issuance, claims of persistent browser balances, custody or real execution. Round 021 is **Pending** until Site/Core GitHub CI, public exact-source Vercel Production, HTTP 200/negative API checks and 1366px + 390px public browser screenshots all succeed.


## Round 022 — signed PAPER reservation snapshot (read-only, separate from browser demo)
Run `node web/paper-holds.test.cjs` plus actual PostgreSQL 16 `node qa/paper-holds.pg.test.cjs` after balance/reservation PG fixtures; deployed source uses `node qa/paper-holds.public.test.cjs` and public Chromium workflow.
- Given a verified HMAC scoped exactly `paper:holds:read`, GET /api/paper-holds reads only signed owner using a prepared account parameter `$1`, showing synthetic ACTIVE/RELEASED reservations (not trades).
- Given forged/expired/treasury/balance-only token, reject 401 before accessing PostgreSQL; query/body account overrides ignored.
- Given POST/PUT/PATCH/DELETE/OPTIONS, return 405 without modifying funds. HEAD has no body. Public anonymous access must yield 401/503 without leaking holdings.
- Given missing production DB config, fail closed 503. Any PostgreSQL exception or leaked secret must not reach client JSON.
- Given invalid precision, a negative amount, unknown asset/state, duplicate IDs or over 100 records, refuse 503 rather than show a partial or corrupt list; verify a restored read succeeds.
- Given an actual PostgreSQL state transition, a subsequent read transaction observes committed status; another owner never sees the record.
- The live terminal stays volatile BROWSER MEMORY ONLY; no public token issuer, durable browser orders, real execution, funding, keys or KYC.
- Acceptance requires green PR/main Site+PG and Core CI, Vercel Production READY exact feature SHA, public HTTP/Chromium/screenshots, and public negative API verification; otherwise Pending.

## Round 023 — atomic signed PAPER balance/hold snapshot
Given one valid HMAC bearer with scope paper:snapshot:read, GET /api/paper-snapshot must read BOTH BTC/USDC balances and up to 100 reservations with one signed owner and one PostgreSQL REPEATABLE READ READ ONLY transaction. Query or body owner overrides must never change tenant selection. The sum of ACTIVE holds by asset must match LOCKED using exact 18-decimal BigInt; RELEASED holds do not contribute. Any missing asset, malformed amount, duplicate hold, overlock, incomplete result, too many holds or imbalance must reject the entire response HTTP 503 and never return partial data. Invalid, expired or wrong-scope tokens and treasury subject must fail HTTP 401 when configured; anonymous public GET returns 401 or 503 depending on paper database settings; all write methods return 405 even with valid credentials. No token issuer, public order-entry API or real assets. Real isolated PostgreSQL 16 tests, merged-main CI, exact-sha Production READY, public HTTPS negative gate and desktop/mobile Chromium screenshots are required before Accepted.


## R024 — trusted server-only PAPER reservation API (negative BDD)
Run \`node web/paper-reserve.test.cjs\` and \`node qa/paper-reserve.pg.test.cjs\` on disposable PostgreSQL 16. \`POST /api/paper-reserve\` is **disabled by default** until the three server-side controls are present: \`PAPER_RESERVATIONS_WRITE_ENABLED=sandbox-only\`, private 32+ character \`PAPER_SESSION_SECRET\`, and isolated \`PAPER_DATABASE_URL\`. This is not a public order/fill endpoint, and no public token issuer exists.
- Given disabled configuration, POST returns 503 before any DB connection; GET/HEAD/PUT/PATCH/DELETE/OPTIONS all return 405. Browser Origin requests (even same-origin) return 403 when enabled, without CORS/cookie authentication.
- Given signed capability of exact scope \`paper:reservations:write\` and synthetic subject starting with \`paper_\`, accept only JSON \`id\`, \`asset\`, and exact decimal-string \`amount\`. Reject unsigned/expired/tampered token, owner override, malformed ID, incorrect scope, overprecision, floats, exponent/negative/zero amount before DB access.
- Given synthetic account 100 USDC and reservation 30.00, committed POST yields 201; equivalent idempotent replay returns 200 without a second lock; after server-side cancel, replay returns RELEASED. Cross-owner replay, overdraft, mismatch return generic 409. Unknown DB failures return generic 503 without sensitive internals.
- Public signed-out HTTPS GET must be 405 and unsigned POST must be 401/503. Exact GitHub main Vercel Production SHA plus real public desktop/390px Chromium screenshots are required before Accepted. Public site continues **BROWSER MEMORY ONLY**; no true matching, trades, custody, keys or KYC.
