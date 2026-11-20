#!/usr/bin/env bash
set -euo pipefail
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
javac -d "$OUT" src/main/java/exchange/*.java \
 src/test/java/exchange/ExchangeCoreBDD.java \
 src/test/java/exchange/PostgresLedgerValidationBDD.java
java -cp "$OUT" exchange.ExchangeCoreBDD
java -cp "$OUT" exchange.PostgresLedgerValidationBDD
echo "Standalone BDD passed (PostgreSQL integration: run mvn test with POSTGRES_JDBC_URL)"
