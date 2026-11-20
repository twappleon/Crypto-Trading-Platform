package exchange;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

/** Round 005: PAPER-only order/hold atomicity, persistence and hostile inputs. */
class PaperOrderRound005Test {
    static String url, user, password;
    static PostgresLedger ledger;
    static PaperHoldService holds;
    static PaperOrderService orders;

    static BigDecimal d(String value) { return new BigDecimal(value); }
    static String id() { return "r005_" + UUID.randomUUID().toString().replace("-", ""); }
    static void eq(String expected, BigDecimal actual) {
        assertEquals(0, actual.compareTo(d(expected)), "expected " + expected + ", got " + actual);
    }

    @BeforeAll
    static void prepare() throws Exception {
        url = System.getenv("POSTGRES_JDBC_URL");
        if ("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url, "CI PostgreSQL is required");
        else Assumptions.assumeTrue(url != null, "PostgreSQL disposable DB missing");
        user = System.getenv().getOrDefault("POSTGRES_USER", "paper");
        password = System.getenv().getOrDefault("POSTGRES_PASSWORD", "paper");
        try (var c = DriverManager.getConnection(url, user, password)) { PostgresLedger.migrate(c); }
        PostgresLedger.Connections open = () -> DriverManager.getConnection(url, user, password);
        ledger = new PostgresLedger(open);
        holds = new PaperHoldService(open);
        orders = new PaperOrderService(open);
    }

    @Test
    void buyAndSellHoldCorrectAssetsWithoutSpendingPaperFunds() {
        String buyer = id(), seller = id(), bid = id(), ask = id();
        ledger.creditForTest(id(), buyer, "USDC", d("100"));
        ledger.creditForTest(id(), seller, "BTC", d("5"));
        assertTrue(orders.place(bid, buyer, "BTC", "USDC", ExchangeCore.Side.BUY, d("12.00"), d("2.5")));
        assertTrue(orders.place(ask, seller, "BTC", "USDC", ExchangeCore.Side.SELL, d("12"), d("2.5")));
        eq("30", holds.balance(buyer, "USDC").locked());
        eq("70", holds.balance(buyer, "USDC").available());
        eq("2.5", holds.balance(seller, "BTC").locked());
        eq("2.5", holds.balance(seller, "BTC").available());
        eq("100", ledger.balance(buyer, "USDC"));
        eq("5", ledger.balance(seller, "BTC"));
        PaperOrderService fresh = new PaperOrderService(() -> DriverManager.getConnection(url,user,password));
        assertEquals("OPEN", fresh.get(bid, buyer).state());
        assertEquals("USDC", fresh.get(bid, buyer).heldAsset());
        assertEquals("BTC", fresh.get(ask, seller).heldAsset());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void idempotentOrderCannotBeChangedOrReactivatedAfterCancel() {
        String owner=id(), stranger=id(), order=id();
        ledger.creditForTest(id(), owner, "USDC", d("60"));
        assertTrue(orders.place(order, owner, "BTC", "USDC", ExchangeCore.Side.BUY, d("10"), d("2")));
        assertFalse(orders.place(order, owner, "BTC", "USDC", ExchangeCore.Side.BUY, d("10.00"), d("2.000")));
        eq("20", holds.balance(owner, "USDC").locked());
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(order, owner, "BTC", "USDC", ExchangeCore.Side.BUY,d("11"),d("2")));
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(order, stranger, "BTC", "USDC", ExchangeCore.Side.BUY,d("10"),d("2")));
        assertThrows(IllegalArgumentException.class, () -> orders.cancel(order, stranger));
        assertThrows(IllegalArgumentException.class, () -> orders.get(order, stranger));
        assertThrows(IllegalArgumentException.class,
                () -> holds.release("order:" + order, owner, "USDC"));
        assertThrows(IllegalArgumentException.class,
                () -> holds.reserve("order:" + id(), owner, "USDC", d("1")));
        assertTrue(orders.cancel(order, owner));
        assertFalse(orders.cancel(order, owner));
        assertEquals("CANCELED", orders.get(order, owner).state());
        assertFalse(orders.place(order, owner, "BTC", "USDC", ExchangeCore.Side.BUY,d("10"),d("2")));
        eq("0", holds.balance(owner, "USDC").locked());
        eq("60", holds.balance(owner, "USDC").available());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void badOrdersAndInsufficientBalancesCannotLeaveOrphanHolds() {
        String owner=id(), order=id();
        ledger.creditForTest(id(), owner, "USDC", d("20"));
        assertThrows(IllegalStateException.class,
                () -> orders.place(order,owner,"BTC","USDC",ExchangeCore.Side.BUY,d("11"),d("2")));
        assertThrows(IllegalArgumentException.class, () -> orders.get(order,owner),
                "failed placement must not persist an order");
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(id(),owner,"BTC","BTC",ExchangeCore.Side.BUY,d("1"),d("1")));
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(id(),owner,"BTC","USDC",ExchangeCore.Side.BUY,d("0"),d("1")));
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(id(),owner,"BTC","USDC",ExchangeCore.Side.BUY,d("0.000000000000000001"),d("0.000000000000000001")));
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(id(),"treasury","BTC","USDC",ExchangeCore.Side.BUY,d("1"),d("1")));
        assertThrows(IllegalStateException.class,
                () -> orders.place(id(),owner,"BTC","USDC",ExchangeCore.Side.SELL,d("1"),d("1")));
        eq("0", holds.balance(owner, "USDC").locked());
        eq("20", holds.balance(owner, "USDC").available());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void legacyHoldIdCollisionRollsBackOrderCreation() throws Exception {
        String owner=id(), order=id();
        ledger.creditForTest(id(),owner,"USDC",d("20"));
        // Simulate an existing legacy hold using the order-reserved namespace.
        try (var c=DriverManager.getConnection(url,user,password);
             var p=c.prepareStatement("INSERT INTO paper_ledger_holds(id,asset,account_id,amount) VALUES (?,'USDC',?,5)")) {
            p.setString(1,"order:"+order);p.setString(2,owner);p.executeUpdate();
        }
        assertThrows(IllegalArgumentException.class,
                () -> orders.place(order,owner,"BTC","USDC",ExchangeCore.Side.BUY,d("10"),d("1")));
        assertThrows(IllegalArgumentException.class, () -> orders.get(order,owner));
        eq("5", holds.balance(owner,"USDC").locked());
        eq("15", holds.balance(owner,"USDC").available());
        assertTrue(ledger.verifyConservation());
    }

    @Test
    void concurrentOrdersCannotOversubscribeCollateral() throws Exception {
        String owner=id();
        ledger.creditForTest(id(),owner,"USDC",d("100"));
        try (var pool=Executors.newFixedThreadPool(12)) {
            List<Callable<Boolean>> calls=new ArrayList<>();
            for(int i=0;i<12;i++){
                String order=id();
                calls.add(() -> {
                    try { return orders.place(order,owner,"BTC","USDC",ExchangeCore.Side.BUY,d("10"),d("1")); }
                    catch(IllegalStateException e) {
                        if(!"insufficient available paper balance".equals(e.getMessage())) throw e;
                        return false;
                    }
                });
            }
            var futures=pool.invokeAll(calls,60,TimeUnit.SECONDS);
            int accepted=0;
            for(var f:futures){ assertFalse(f.isCancelled(),"order queue hung"); if(f.get())accepted++; }
            assertEquals(10,accepted);
        }
        eq("100",holds.balance(owner,"USDC").locked());
        eq("0",holds.balance(owner,"USDC").available());
        assertTrue(ledger.verifyConservation());
    }
}
