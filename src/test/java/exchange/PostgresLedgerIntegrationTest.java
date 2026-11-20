package exchange;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

class PostgresLedgerIntegrationTest {
    private static PostgresLedger ledger;
    private static String url;
    private static String user;
    private static String password;

    static BigDecimal d(String amount) { return new BigDecimal(amount); }
    static void balance(String owner, String expected) {
        assertEquals(0, ledger.balance(owner, "USDC").compareTo(d(expected)));
    }

    @BeforeAll
    static void prepare() throws Exception {
        url = System.getenv("POSTGRES_JDBC_URL");
        if ("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS"))) {
            assertNotNull(url, "CI must provide PostgreSQL integration URL");
        } else {
            Assumptions.assumeTrue(url != null, "Standalone run skips PG integration only");
        }
        user = System.getenv().getOrDefault("POSTGRES_USER", "paper");
        password = System.getenv().getOrDefault("POSTGRES_PASSWORD", "paper");
        try (var connection = DriverManager.getConnection(url, user, password)) {
            PostgresLedger.migrate(connection);
        }
        ledger = new PostgresLedger(() -> DriverManager.getConnection(url, user, password));
    }

    @Test
    void commitsBalancedEntriesAndIdempotentlyRejectsConflicts() throws Exception {
        String prefix = "test_" + UUID.randomUUID().toString().replace("-", "");
        String alice = prefix + "_alice", bob = prefix + "_bob";
        assertTrue(ledger.creditForTest(prefix + "_fund", alice, "USDC", d("100")));
        assertTrue(ledger.transfer(prefix + "_move", alice, bob, "USDC", d("40.000")));
        assertFalse(ledger.transfer(prefix + "_move", alice, bob, "USDC", d("40")));
        balance(alice, "60");
        balance(bob, "40");
        // A fresh object and connection must read committed balances after "restart".
        PostgresLedger restarted = new PostgresLedger(
            () -> DriverManager.getConnection(url, user, password));
        assertEquals(0, restarted.balance(alice, "USDC").compareTo(d("60")));
        assertFalse(restarted.transfer(prefix + "_move", alice, bob, "USDC", d("40")));
        assertEquals(0, restarted.balance(bob, "USDC").compareTo(d("40")));
        assertThrows(IllegalArgumentException.class,
            () -> ledger.transfer(prefix + "_move", alice, bob, "USDC", d("39")));
        assertThrows(IllegalStateException.class,
            () -> ledger.transfer(prefix + "_overdraft", alice, bob, "USDC", d("61")));
        balance(alice, "60");
        balance(bob, "40");
        try (var c = DriverManager.getConnection(url, user, password);
             var p = c.prepareStatement("SELECT count(*), sum(delta) FROM paper_ledger_entries WHERE journal_id=?")) {
            p.setString(1, prefix + "_move");
            try (var r = p.executeQuery()) {
                assertTrue(r.next());
                assertEquals(2, r.getInt(1));
                assertEquals(0, r.getBigDecimal(2).compareTo(BigDecimal.ZERO));
            }
        }
    }

    @Test
    void competingDebitsCannotOverdrawSameAccount() throws Exception {
        String prefix = "concurrent_" + UUID.randomUUID().toString().replace("-", "");
        String alice = prefix + "_alice", bob = prefix + "_bob";
        ledger.creditForTest(prefix + "_fund", alice, "USDC", d("100"));
        try (var pool = Executors.newFixedThreadPool(12)) {
            List<Callable<Boolean>> tasks = new ArrayList<>();
            for (int i = 0; i < 12; i++) {
                String journal = prefix + "_debit_" + i;
                tasks.add(() -> {
                    try {
                        return ledger.transfer(journal, alice, bob, "USDC", d("10"));
                    } catch (IllegalStateException expectedOverdraft) {
                        if (!"insufficient paper balance".equals(expectedOverdraft.getMessage())) throw expectedOverdraft;
                        return false;
                    }
                });
            }
            var futures = pool.invokeAll(tasks, 45, TimeUnit.SECONDS);
            int committed = 0;
            for (var future : futures) {
                assertFalse(future.isCancelled(), "no transaction may hang indefinitely");
                if (future.get()) committed++;
            }
            assertEquals(10, committed);
        }
        balance(alice, "0");
        balance(bob, "100");
    }
}
