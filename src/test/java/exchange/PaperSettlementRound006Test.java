package exchange;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PaperSettlementRound006Test {
    static PostgresLedger ledger;
    static PaperOrderService orders;
    static PaperHoldService holds;
    static PaperSettlementService settlement;
    static String id(){return "r006_"+UUID.randomUUID().toString().replace("-","");}
    static BigDecimal d(String s){return new BigDecimal(s);}
    static void eq(String expected,BigDecimal actual){
        assertEquals(0,d(expected).compareTo(actual),"expected "+expected+", got "+actual);
    }

    @BeforeAll static void setup() throws Exception {
        String url=System.getenv("POSTGRES_JDBC_URL");
        if("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url,"CI must have disposable PostgreSQL");
        else Assumptions.assumeTrue(url!=null,"disposable PostgreSQL absent");
        String user=System.getenv().getOrDefault("POSTGRES_USER","paper");
        String pass=System.getenv().getOrDefault("POSTGRES_PASSWORD","paper");
        try(var c=DriverManager.getConnection(url,user,pass)){PostgresLedger.migrate(c);}
        PostgresLedger.Connections open=()->DriverManager.getConnection(url,user,pass);
        ledger=new PostgresLedger(open);
        holds=new PaperHoldService(open);
        orders=new PaperOrderService(open);
        settlement=new PaperSettlementService(open);
    }
    @Test void partialAndFinalFillAreAtomicWithPriceTimeMakerPrice() {
        String buyer=id(),seller=id(),bid=id(),ask=id();
        ledger.creditForTest(id(),buyer,"USDC",d("100"));
        ledger.creditForTest(id(),seller,"BTC",d("5"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,d("11"),d("3"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,d("10"),d("3"));
        assertTrue(settlement.settle(id(),bid,ask,d("2")));
        eq("11",holds.balance(buyer,"USDC").locked());
        eq("67",holds.balance(buyer,"USDC").available());
        eq("1",holds.balance(seller,"BTC").locked());
        eq("22",ledger.balance(seller,"USDC"));
        eq("2",ledger.balance(buyer,"BTC"));
        eq("1",orders.get(bid,buyer).remaining());
        assertEquals("PARTIAL",orders.get(ask,seller).state());
        assertTrue(settlement.settle(id(),bid,ask,d("1")));
        eq("0",holds.balance(buyer,"USDC").locked());
        eq("0",holds.balance(seller,"BTC").locked());
        eq("67",ledger.balance(buyer,"USDC"));
        eq("33",ledger.balance(seller,"USDC"));
        eq("3",ledger.balance(buyer,"BTC"));
        assertEquals("FILLED",orders.get(bid,buyer).state());
        assertThrows(IllegalStateException.class,()->orders.cancel(bid,buyer));
        assertTrue(ledger.verifyConservation());
    }
    @Test void askMakerUsesLowerPriceAndRefundsBuyerLimitSpread() {
        String buyer=id(),seller=id(),bid=id(),ask=id(),trade=id();
        ledger.creditForTest(id(),buyer,"USDC",d("100"));
        ledger.creditForTest(id(),seller,"BTC",d("4"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,d("10"),d("2"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,d("12"),d("2"));
        eq("24",holds.balance(buyer,"USDC").locked());
        assertTrue(settlement.settle(trade,ask,bid,d("2")));
        assertFalse(settlement.settle(trade,ask,bid,d("2")));
        eq("80",holds.balance(buyer,"USDC").available());
        eq("0",holds.balance(buyer,"USDC").locked());
        eq("20",ledger.balance(seller,"USDC"));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(trade,ask,bid,d("1")));
        assertTrue(ledger.verifyConservation());
    }
    @Test void hostilePairsAndCanceledOrdersNeverSpendFunds() {
        String buyer=id(),seller=id(),bid=id(),ask=id();
        ledger.creditForTest(id(),buyer,"USDC",d("100"));
        ledger.creditForTest(id(),seller,"BTC",d("3"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,d("9"),d("2"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,d("10"),d("2"));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),ask,bid,d("1")));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),ask,ask,d("1")));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),ask,bid,d("-1")));
        assertTrue(orders.cancel(ask,seller));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),ask,bid,d("3")));
        assertThrows(IllegalStateException.class,()->settlement.settle(id(),ask,bid,d("1")));
        eq("100",ledger.balance(buyer,"USDC"));
        eq("3",ledger.balance(seller,"BTC"));
        eq("18",holds.balance(buyer,"USDC").locked());
        assertTrue(ledger.verifyConservation());
    }
    @Test void sameOwnerSelfTradeRejectedWithoutMutation() {
        String owner=id(),bid=id(),ask=id();
        ledger.creditForTest(id(),owner,"USDC",d("100"));
        ledger.creditForTest(id(),owner,"BTC",d("3"));
        orders.place(bid,owner,"BTC","USDC",ExchangeCore.Side.BUY,d("10"),d("1"));
        orders.place(ask,owner,"BTC","USDC",ExchangeCore.Side.SELL,d("10"),d("1"));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),ask,bid,d("1")));
        eq("10",holds.balance(owner,"USDC").locked());
        eq("1",holds.balance(owner,"BTC").locked());
        assertTrue(ledger.verifyConservation());
    }
    @Test void partialFillThenCancelReleasesOnlyRemainingCollateral() {
        String buyer=id(),seller=id(),bid=id(),ask=id();
        ledger.creditForTest(id(),buyer,"USDC",d("50"));
        ledger.creditForTest(id(),seller,"BTC",d("2"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,d("15"),d("2"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,d("14"),d("2"));
        assertTrue(settlement.settle(id(),ask,bid,d("1")));
        eq("15",holds.balance(buyer,"USDC").locked());
        assertTrue(orders.cancel(bid,buyer));
        eq("0",holds.balance(buyer,"USDC").locked());
        eq("36",holds.balance(buyer,"USDC").available());
        eq("1",orders.get(bid,buyer).remaining());
        assertEquals("CANCELED",orders.get(bid,buyer).state());
        assertTrue(ledger.verifyConservation());
    }
}
