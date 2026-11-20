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
