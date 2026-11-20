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
