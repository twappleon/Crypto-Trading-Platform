# Crypto Trading Platform — paper-only MVP

[GitHub Actions](https://github.com/twappleon/Crypto-Trading-Platform/actions) · [100-Round Ledger](docs/PROGRESS.md) · [Product Requirements](docs/PRD.md) · [BDD](docs/BDD.md)

The project builds a demonstrable spot-trading MVP **strictly in PAPER/SANDBOX mode**. It is **not** a deployed, regulated, secure or production-ready exchange. Do not send real assets, keys, wallets or customer KYC data.

## Implemented prototype

- `ExchangeCore`: deterministic Java 21 in-memory limit-price book with price/time priority, partial fills, cancellation and self-trade prevention.
- `PostgresLedger`: PostgreSQL double-entry journal prototype with atomic SQL transactions; sorted `FOR UPDATE` account locks; serialized conflicting debits; idempotent journal IDs; balanced per-asset deltas; scale/precision constraints and non-negative paper user balances.
- PostgreSQL schemas `V1__paper_ledger.sql` and `V2__paper_ledger_guards.sql`: deferred commit-time journal conservation, append-only entry/journal guards, read-only balance reconciliation, and bounded retry for SQLSTATE 40001/40P01. JUnit BDD uses PostgreSQL 16 in GitHub Actions.

## Run

```bash
bash run-tests.sh      # JDK 21 only: deterministic in-memory and validation BDD
# PostgreSQL integration: use disposable database and Java 21 + Maven
export POSTGRES_JDBC_URL='jdbc:postgresql://localhost:5432/paper'
export POSTGRES_USER=paper
export POSTGRES_PASSWORD=paper
export REQUIRE_POSTGRES_TESTS=1
mvn -B -ntp test
```

Do not point this prototype at production credentials. `PostgresLedger.migrate` is a one-time disposable-schema helper, not a full production migration framework.

**Important gaps:** no order-to-ledger reservation and settlement coupling, persistent matching engine, crash recovery, authentication, admin, true KYC provider integration, chain custody, deployment, or independent security review. Commit-time constraint triggers now reject empty/unbalanced new journals and disallow updates/deletes of entries and journal records. Privileged operators can still alter account balances directly: use `verifyConservation()` to detect drift. This remains a disposable proof, not a production hardened ledger. Never represent this as production funds-safe.

A round is **Accepted** only when code changes are real, BDD and CI both succeed, SHA is recorded, and [docs/PROGRESS.md](docs/PROGRESS.md) is updated. Failed and pending rounds do not count.
