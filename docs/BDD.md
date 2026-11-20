# Executable BDD contract — rounds 001 and 002

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

**Gate:** mark round Accepted only after CI green. Round 003 should address transactional failure/retry and DB-side conservation verification. Round 004 should add available/locked balances before connecting the matching engine.
