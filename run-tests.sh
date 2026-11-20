#!/usr/bin/env bash
set -euo pipefail
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
javac -d "$OUT" src/main/java/exchange/*.java \
 src/test/java/exchange/ExchangeCoreBDD.java \
 src/test/java/exchange/PostgresLedgerValidationBDD.java \
 src/test/java/exchange/PaperFeePolicyBDD.java
java -cp "$OUT" exchange.ExchangeCoreBDD
java -cp "$OUT" exchange.PostgresLedgerValidationBDD
java -cp "$OUT" exchange.PaperFeePolicyBDD
echo "Standalone BDD passed (PostgreSQL integration: run mvn test with POSTGRES_JDBC_URL)"
