package exchange;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Round 004: hold/release, overdraft/identity and concurrent mutation BDD. */
class PaperHoldRound004Test {
    static String url, user, password;
    static PostgresLedger ledger;
    static PaperHoldService holds;
    static BigDecimal d(String x) { return new BigDecimal(x); }
    static String id() { return "r004_" + UUID.randomUUID().toString().replace("-", ""); }
    static void eq(String expected, BigDecimal actual) {
        assertEquals(0, actual.compareTo(d(expected)), "expected " + expected + " but got " + actual);
    }

    @BeforeAll
    static void prepare() throws Exception {
        url = System.getenv("POSTGRES_JDBC_URL");
        if ("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url, "CI must supply PostgreSQL connection");
        else Assumptions.assumeTrue(url != null, "PostgreSQL test requires disposable database");
        user = System.getenv().getOrDefault("POSTGRES_USER", "paper");
        password = System.getenv().getOrDefault("POSTGRES_PASSWORD", "paper");
        try (var c = DriverManager.getConnection(url, user, password)) {
            PostgresLedger.migrate(c);
        }
        ledger = new PostgresLedger(() -> DriverManager.getConnection(url, user, password));
        holds = new PaperHoldService(() -> DriverManager.getConnection(url, user, password));
    }

    @Test
    void reservationAndReleaseAreDurableAndIdempotent() {
        String account = id(), hold = id();
        ledger.creditForTest(id(), account, "USDC", d("100"));
        assertTrue(holds.reserve(hold, account, "USDC", d("70.000")));
        assertFalse(holds.reserve(hold, account, "USDC", d("70")));
        var balance = holds.balance(account, "USDC");
        eq("100", balance.total());
        eq("70", balance.locked());
        eq("30", balance.available());
        assertTrue(ledger.verifyConservation());
        // A fresh service sees the same persisted hold.
        PaperHoldService restarted = new PaperHoldService(
                () -> DriverManager.getConnection(url, user, password));
        eq("70", restarted.balance(account, "USDC").locked());
        assertTrue(restarted.release(hold, account, "USDC"));
        assertFalse(restarted.release(hold, account, "USDC"));
        assertFalse(holds.reserve(hold, account, "USDC", d("70")),
                "replaying a released ID must never silently re-lock");
        eq("0", holds.balance(account, "USDC").locked());
        eq("100", holds.balance(account, "USDC").available());
    }

    @Test
    void insufficientAndUnauthorizedRequestsCannotChangeFunds() {
        String owner = id(), other = id(), held = id();
        ledger.creditForTest(id(), owner, "USDC", d("20"));
        assertThrows(IllegalStateException.class,
                () -> holds.reserve(id(), owner, "USDC", d("21")));
        assertTrue(holds.reserve(held, owner, "USDC", d("12")));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve(held, owner, "USDC", d("11")));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve(held, other, "USDC", d("12")));
        assertThrows(IllegalArgumentException.class,
                () -> holds.release(held, other, "USDC"));
        assertThrows(IllegalArgumentException.class,
                () -> holds.release(held, owner, "BTC"));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve(id(), "treasury", "USDC", d("1")));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve(id(), owner, "USDC", d("0")));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve(id(), owner, "USDC", d("0.0000000000000000001")));
        assertThrows(IllegalStateException.class,
                () -> holds.reserve(id(), id(), "USDC", d("1")));
        eq("12", holds.balance(owner, "USDC").locked());
        eq("8", holds.balance(owner, "USDC").available());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void alreadyLockedValueCannotBeTransferredUntilReleased() {
        String alice = id(), bob = id(), hold = id();
        ledger.creditForTest(id(), alice, "USDC", d("100"));
        holds.reserve(hold, alice, "USDC", d("75"));
        assertThrows(IllegalStateException.class,
                () -> ledger.transfer(id(), alice, bob, "USDC", d("26")));
        eq("100", ledger.balance(alice, "USDC"));
        eq("0", ledger.balance(bob, "USDC"));
        eq("75", holds.balance(alice, "USDC").locked());
        ledger.transfer(id(), alice, bob, "USDC", d("25"));
        eq("75", ledger.balance(alice, "USDC"));
        eq("0", holds.balance(alice, "USDC").available());
        assertTrue(holds.release(hold, alice, "USDC"));
        ledger.transfer(id(), alice, bob, "USDC", d("50"));
        eq("25", holds.balance(alice, "USDC").available());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void simultaneousHoldsCannotOversubscribeAvailableBalance() throws Exception {
        String owner = id();
        ledger.creditForTest(id(), owner, "USDC", d("100"));
        try (var pool = Executors.newFixedThreadPool(12)) {
            List<Callable<Boolean>> requests = new ArrayList<>();
            for (int n = 0; n < 12; n++) {
                String hold = id();
                requests.add(() -> {
                    try {
                        return holds.reserve(hold, owner, "USDC", d("10"));
                    } catch (IllegalStateException e) {
                        if (!"insufficient available paper balance".equals(e.getMessage())) throw e;
                        return false;
                    }
                });
            }
            var results = pool.invokeAll(requests, 60, TimeUnit.SECONDS);
            int accepted = 0;
            for (var future : results) {
                assertFalse(future.isCancelled(), "transactions must not hang");
                if (future.get()) accepted++;
            }
            assertEquals(10, accepted, "exactly ten holds of 10 from a 100 account");
        }
        eq("100", holds.balance(owner, "USDC").locked());
        eq("0", holds.balance(owner, "USDC").available());
        assertThrows(IllegalStateException.class,
                () -> ledger.transfer(id(), owner, id(), "USDC", d("1")));
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void databaseRejectsInvalidHoldRowsAndBalancesRemainUnchanged() throws Exception {
        String owner = id();
        ledger.creditForTest(id(), owner, "USDC", d("5"));
        try (var c = DriverManager.getConnection(url, user, password);
             var p = c.prepareStatement(
                     "INSERT INTO paper_ledger_holds(id,asset,account_id,amount) VALUES (?,'USDC',?,-1)")) {
            p.setString(1, id());
            p.setString(2, owner);
            SQLException failure = assertThrows(SQLException.class, p::executeUpdate);
            assertEquals("23514", failure.getSQLState());
        }
        eq("5", holds.balance(owner, "USDC").available());
        assertTrue(ledger.verifyConservation());
    }
}
