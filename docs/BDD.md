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
