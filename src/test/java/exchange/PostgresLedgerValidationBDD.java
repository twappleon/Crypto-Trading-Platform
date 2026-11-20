package exchange;

import java.math.BigDecimal;
import java.util.Map;
import static exchange.PostgresLedger.validate;

/** Standalone negative validations, executable without a PostgreSQL server. */
public final class PostgresLedgerValidationBDD {
    static BigDecimal d(String s) { return new BigDecimal(s); }
    static void rejects(Runnable action, String name) {
        boolean rejected = false;
        try { action.run(); } catch (IllegalArgumentException e) { rejected = true; }
        if (!rejected) throw new AssertionError("Expected rejection: " + name);
    }
    public static void main(String[] args) {
        validate("j-1", "USDC", Map.of("alice", d("-0.5"), "bob", d("0.500000000")));
        rejects(() -> validate("x", "USDC", Map.of("alice", d("-1"), "bob", d("0.99"))), "unbalanced");
        rejects(() -> validate("x", "USDC", Map.of("alice", d("1"), "bob", d("-1.0000000000000000001"))), "too many decimals");
        rejects(() -> validate("x", "USDC", Map.of("alice", d("100000000000000000000"), "bob", d("-100000000000000000000"))), "too many integer digits");
        rejects(() -> validate("x", "USDC", Map.of("alice", d("0"), "bob", d("0"))), "zero entries");
        rejects(() -> validate("x", "USDC", Map.of("alice", d("-1"))), "one-sided");
        rejects(() -> validate("x", "usdc", Map.of("alice", d("-1"), "bob", d("1"))), "noncanonical asset");
        rejects(() -> validate("x", "USDC", Map.of("alice';drop", d("-1"), "bob", d("1"))), "unsafe account");
        rejects(() -> validate("", "USDC", Map.of("alice", d("-1"), "bob", d("1"))), "invalid id");
        var nullEntry = new java.util.HashMap<String, BigDecimal>();
        nullEntry.put("alice", d("-1"));
        nullEntry.put("bob", null);
        rejects(() -> validate("x", "USDC", nullEntry), "null entry");
        System.out.println("PASS: SQL ledger validation and negative BDD");
    }
}
