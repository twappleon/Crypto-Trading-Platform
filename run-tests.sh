#!/usr/bin/env bash
set -euo pipefail
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
javac -d "$OUT" src/main/java/exchange/ExchangeCore.java src/test/java/exchange/ExchangeCoreBDD.java
java -cp "$OUT" exchange.ExchangeCoreBDD
