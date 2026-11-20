# Executable BDD contract — rounds 001–003

## Standalone JDK 21
`bash run-tests.sh`

### Matching prototype (001)
Given asks at 100, when a compatible buy 101 arrives, then the execution uses the resting maker price.
Given equal-price asks, when crossed, then earliest maker fills first.
Given a partially filled maker, then remaining quantity is correct.
Given another owner, when attempting cancel, then reject.
Given own open order, when cancelling, then remove from book.
Given invalid or self-crossing orders, then reject with no partial mutation.

### Ledger input safety (002)
Given balanced journals, then validate successfully.
Given unbalanced, one-sided, zero, null or precision-overflow entries, reject before database mutation.
Given unsafe account ID or invalid asset/journal ID, reject.

## PostgreSQL 16 service (002)
`POSTGRES_JDBC_URL=jdbc:postgresql://localhost:5432/paper POSTGRES_USER=paper POSTGRES_PASSWORD=paper REQUIRE_POSTGRES_TESTS=1 mvn -B -ntp test`

Given 100 paper USDC credit, when 40 transfers, then sender=60 and recipient=40 with two opposite journal entries summing to zero.
Given the same journal ID and mathematically equivalent 40/40.000 amounts, then posting it again changes nothing.
Given the same journal ID and changed amount, then reject.
Given insufficient funds, then reject and preserve both account balances.
Given 12 concurrent debits of 10 from a balance of 100, then exactly 10 succeed, 2 fail, and sum remains 100.
All tests use unique IDs and a disposable PostgreSQL service; no real funds.

## Round 003 PostgreSQL BDD and negative contract
Given an unbalanced journal inserted via direct SQL, when COMMIT is attempted, the deferred constraint trigger rejects SQLSTATE 23514 and rolls back the entire journal.
Given a committed paper journal, when any entry is UPDATEd or the journal is DELETEd, then reject with SQLSTATE 55000 and preserve the original balances.
Given a legitimately funded paper account, when a privileged SQL UPDATE changes its balance without a journal, then `verifyConservation()` detects drift; the test restores the original balance.
Given simulated SQLSTATE 40001 on the first two connection attempts, when the bounded retry helper posts the same journal ID, then exactly one journal is posted and the helper succeeds on the third attempt.
Given uncertain SQLSTATE 08006, when the helper posts, then it rejects without automatic retry. Bad maxAttempts also rejects.

**Gate:** mark round Accepted only after CI green. Round 003 should address transactional failure/retry and DB-side conservation verification. Round 004 should add available/locked balances before connecting the matching engine.


## Round 004 — PostgreSQL reserve/release / negative BDD
Run `POSTGRES_JDBC_URL=jdbc:postgresql://localhost:5432/paper POSTGRES_USER=paper POSTGRES_PASSWORD=paper REQUIRE_POSTGRES_TESTS=1 mvn -B -ntp test`.
- Given 100 USDC synthetic total and a 70 hold, expect total=100, locked=70, available=30 across restarted service connections.
- Repeating identical hold ID, including after release, is a no-op; changed amount/account/asset is rejected.
- Releasing as another owner or wrong asset is rejected; repeating a correct release is a no-op.
- A hold that exceeds available funds, zero/too precise amount or a hold on treasury is rejected without mutation.
- Given 100 total and 75 locked, attempting a transfer of 26 is rejected atomically; transferring 25 is allowed and leaves zero available. Releasing the hold restores available.
- Given 12 concurrent hold requests for 10 from 100 total, exactly 10 may succeed and 2 must fail. No negative available or total drift is permitted.
- PostgreSQL CHECK constraints reject invalid negative hold rows. `verifyConservation()` remains true after successful scenarios.
- Round 004 does not connect the matching engine. Round 005 must reserve per-order funds, then Round 006 must atomically settle fills and release unused collateral.


## Round 005 — durable per-order hold BDD
Run `bash run-tests.sh` and `POSTGRES_JDBC_URL=jdbc:postgresql://localhost:5432/paper POSTGRES_USER=paper POSTGRES_PASSWORD=paper REQUIRE_POSTGRES_TESTS=1 mvn -B -ntp test`.
- Given paper USDC/BTC balances, BUY at limit 12 quantity 2.5 reserves 30 USDC; SELL reserves 2.5 BTC. Orders and holds remain visible after reconstructing a service; journal totals remain unchanged.
- Given identical order ID and mathematically equivalent prices/quantities, retries return false, never reserve twice. A reused ID with different owner/market/price/quantity rejects. A canceled ID cannot be revived.
- Given an unauthorized actor, reading or canceling another account's order rejects. Repeated owner cancel is a no-op; first cancel releases collateral within the same transaction.
- Given a reserved `order:` namespace, public hold reserve/release APIs reject attempts to mutate order collateral outside the order transaction.
- Given insufficient balance, missing base asset, invalid quantity/price, fractional overprecision or same-asset pair, the request rejects without creating a ticket or hold.
- Given a preexisting conflicting legacy hold ID, order insertion aborts and restores the exact prior available/locked balances.
- Given 12 concurrent orders each requiring 10 USDC from 100, exactly 10 succeed and 2 fail. A full ledger conservation check passes after each scenario.
- No fills/settlement may occur before Round 006; this gate checks *order reservation* only, not exchange readiness.


## Round 006 — atomic explicit-pair settlement BDD
Execute standalone \`bash run-tests.sh\` and disposable PostgreSQL integration suite \`REQUIRE_POSTGRES_TESTS=1 mvn -B -ntp test\`.
- Given funded buyer 100 USDC and seller 5 BTC with crossing BUY @11 and SELL @10 quantity 3, when maker BUY settles 2 then 1, the execution price is 11, two balanced per-asset journals are written per trade, remaining=1 then 0, states PARTIAL then FILLED, holds shrink then release, ending buyer=67 USDC/3 BTC and seller=33 USDC/2 BTC.
- Given maker SELL @10 and taker BUY limit @12 quantity 2, execution spends 20 USDC and releases all 24 USDC initially locked; buyer has 80 available after completion and seller receives 20.
- Given exact repeated trade ID and same maker/taker/quantity, settlement returns false and does not duplicate balances. Given changed intent on the same ID, reject.
- Given noncrossing prices, same order ID, negative quantity or a self-trade by one owner, reject without journal or hold changes.
- Given order PARTIAL, when owner cancels, only its remaining collateral is released. A subsequent attempted crossing fill rejects.
- Given canceled/filled orders, no new fill; given original order quantity exceeded, no double spend.
- Full regression: 23 JUnit cases, 0 failed/errors/skipped plus JDK standalone BDD, with PostgreSQL 16 in CI Run #93. Include original CI #90 red and corrected green #93 as evidence of negative-test correction.
