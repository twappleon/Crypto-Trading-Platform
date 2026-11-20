package exchange;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Round 003: DB-side conservation, rollback, append-only and retry BDD. */
class PostgresLedgerRound003Test {
    static String url, user, password;
    static PostgresLedger ledger;
    static BigDecimal d(String s) { return new BigDecimal(s); }
    static String id() { return "r003_" + UUID.randomUUID().toString().replace("-", ""); }

    @BeforeAll
    static void prepare() throws Exception {
        url = System.getenv("POSTGRES_JDBC_URL");
        if ("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url, "CI requires PostgreSQL");
        else Assumptions.assumeTrue(url != null, "Local JDK-only run has no PostgreSQL");
        user = System.getenv().getOrDefault("POSTGRES_USER", "paper");
        password = System.getenv().getOrDefault("POSTGRES_PASSWORD", "paper");
        try (var c = DriverManager.getConnection(url, user, password)) {
            PostgresLedger.migrate(c);
        }
        ledger = new PostgresLedger(() -> DriverManager.getConnection(url, user, password));
    }

    @Test
    void rejectsUnbalancedDirectSqlAndRollsBackJournal() throws Exception {
        String owner = id(), journal = id();
        ledger.creditForTest(id(), owner, "USDC", d("10"));
        try (var c = DriverManager.getConnection(url, user, password)) {
            c.setAutoCommit(false);
            try (var j = c.prepareStatement(
                    "INSERT INTO paper_ledger_journals(id,asset,fingerprint) VALUES (?,'USDC',?)")) {
                j.setString(1, journal);
                j.setString(2, "0".repeat(64));
                assertEquals(1, j.executeUpdate());
            }
            try (var e = c.prepareStatement(
                    "INSERT INTO paper_ledger_entries(journal_id,asset,account_id,delta) VALUES (?,'USDC',?,-1)")) {
                e.setString(1, journal);
                e.setString(2, owner);
                assertEquals(1, e.executeUpdate());
            }
            SQLException rejected = assertThrows(SQLException.class, c::commit);
            assertEquals("23514", rejected.getSQLState(), "deferred conservation trigger");
            c.rollback();
        }
        try (var c = DriverManager.getConnection(url, user, password);
             var p = c.prepareStatement("SELECT COUNT(*) FROM paper_ledger_journals WHERE id=?")) {
            p.setString(1, journal);
            try (var r = p.executeQuery()) {
                assertTrue(r.next());
                assertEquals(0, r.getLong(1), "failed commit leaves no journal");
            }
        }
        assertEquals(0, ledger.balance(owner, "USDC").compareTo(d("10")));
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void journalEntriesCannotBeOverwrittenOrDeleted() throws Exception {
        String owner = id(), journal = id();
        ledger.creditForTest(journal, owner, "USDC", d("5"));
        try (var c = DriverManager.getConnection(url, user, password);
             var update = c.prepareStatement(
                     "UPDATE paper_ledger_entries SET delta=delta+1 WHERE journal_id=?")) {
            update.setString(1, journal);
            assertEquals("55000", assertThrows(SQLException.class, update::executeUpdate).getSQLState());
        }
        try (var c = DriverManager.getConnection(url, user, password);
             var delete = c.prepareStatement(
                     "DELETE FROM paper_ledger_journals WHERE id=?")) {
            delete.setString(1, journal);
            assertEquals("55000", assertThrows(SQLException.class, delete::executeUpdate).getSQLState());
        }
        assertEquals(0, ledger.balance(owner, "USDC").compareTo(d("5")));
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void detectsBalanceDriftWithReadOnlySqlAudit() throws Exception {
        String owner = id();
        ledger.creditForTest(id(), owner, "USDC", d("2"));
        assertTrue(ledger.verifyConservation());
        try {
            try (var c = DriverManager.getConnection(url, user, password);
                 var p = c.prepareStatement(
                         "UPDATE paper_ledger_accounts SET balance=balance+1 WHERE asset='USDC' AND account_id=?")) {
                p.setString(1, owner);
                assertEquals(1, p.executeUpdate());
            }
            assertFalse(ledger.verifyConservation(), "privileged balance drift must be visible");
        } finally {
            try (var c = DriverManager.getConnection(url, user, password);
                 var p = c.prepareStatement(
                         "UPDATE paper_ledger_accounts SET balance=balance-1 WHERE asset='USDC' AND account_id=?")) {
                p.setString(1, owner);
                assertEquals(1, p.executeUpdate());
            }
        }
        assertTrue(ledger.verifyConservation(), "restored test account balances reconcile");
    }

    @Test
    void retriesOnlyKnownTransientStatesUsingSameJournalId() {
        String owner = id(), journal = id();
        AtomicInteger opens = new AtomicInteger();
        PostgresLedger flaky = new PostgresLedger(() -> {
            if (opens.incrementAndGet() < 3) throw new SQLException("simulated serialization failure", "40001");
            return DriverManager.getConnection(url, user, password);
        });
        assertTrue(flaky.postWithRetry(journal, "USDC",
                Map.of("treasury", d("-7"), owner, d("7")), 3));
        assertEquals(3, opens.get());
        assertFalse(ledger.post(journal, "USDC", Map.of("treasury", d("-7"), owner, d("7"))));
        assertEquals(0, ledger.balance(owner, "USDC").compareTo(d("7")));
        assertTrue(ledger.verifyConservation());

        AtomicInteger permanentOpens = new AtomicInteger();
        PostgresLedger uncertain = new PostgresLedger(() -> {
            permanentOpens.incrementAndGet();
            throw new SQLException("unknown commit result: don't replay", "08006");
        });
        PostgresLedger.SqlFailure failure = assertThrows(PostgresLedger.SqlFailure.class,
                () -> uncertain.postWithRetry(id(), "USDC",
                        Map.of("treasury", d("-1"), id(), d("1")), 5));
        assertEquals("08006", failure.sqlState());
        assertFalse(failure.retryable());
        assertEquals(1, permanentOpens.get(), "uncertain commit must not be retried");
        assertTrue(PostgresLedger.retryableSqlState("40P01"));
        assertTrue(PostgresLedger.retryableSqlState("40001"));
        assertFalse(PostgresLedger.retryableSqlState("23514"));
        assertThrows(IllegalArgumentException.class,
                () -> flaky.postWithRetry("invalid", "USDC", Map.of("treasury", d("-1"), owner, d("1")), 0));
    }
}
