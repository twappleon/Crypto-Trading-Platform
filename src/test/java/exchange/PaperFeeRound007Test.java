package exchange;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** PostgreSQL-backed fee settlement BDD; strictly synthetic funds. */
class PaperFeeRound007Test {
    static PostgresLedger ledger;
    static PaperOrderService orders;
    static PaperSettlementService settlement;
    static PaperHoldService holds;
    static PostgresLedger.Connections open;
    static String id(){return "r007_"+UUID.randomUUID().toString().replace("-","");}
    static BigDecimal n(String s){return new BigDecimal(s);}
    static void eq(String expected,BigDecimal actual){
        assertEquals(0,n(expected).compareTo(actual),"expected "+expected+" actual "+actual);
    }
    @BeforeAll static void setup() throws Exception {
        String url=System.getenv("POSTGRES_JDBC_URL");
        if("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url,"CI PostgreSQL must be configured");
        else Assumptions.assumeTrue(url!=null,"no disposable PostgreSQL");
        String user=System.getenv().getOrDefault("POSTGRES_USER","paper");
        String pass=System.getenv().getOrDefault("POSTGRES_PASSWORD","paper");
        try(var c=DriverManager.getConnection(url,user,pass)){PostgresLedger.migrate(c);}
        open=()->DriverManager.getConnection(url,user,pass);
        ledger=new PostgresLedger(open);
        orders=new PaperOrderService(open);
        holds=new PaperHoldService(open);
        settlement=new PaperSettlementService(open,new PaperFeePolicy(10,25));
    }
    @Test void makerBuyFeesAreBalancedAcrossBothAssets() throws Exception {
        String buyer=id(),seller=id(),bid=id(),ask=id(),trade=id();
        ledger.creditForTest(id(),buyer,"USDC",n("100"));
        ledger.creditForTest(id(),seller,"BTC",n("3"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,n("11"),n("2"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,n("10"),n("2"));
        BigDecimal baseBefore=ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"BTC");
        BigDecimal quoteBefore=ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"USDC");
        assertTrue(settlement.settle(trade,bid,ask,n("2")));
        eq("1.998",ledger.balance(buyer,"BTC"));
        eq("0.002",ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"BTC").subtract(baseBefore));
        eq("21.945",ledger.balance(seller,"USDC"));
        eq("0.055",ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"USDC").subtract(quoteBefore));
        eq("78",ledger.balance(buyer,"USDC"));
        eq("1",ledger.balance(seller,"BTC"));
        eq("0",holds.balance(buyer,"USDC").locked());
        assertFalse(settlement.settle(trade,bid,ask,n("2")));
        eq("0.002",ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"BTC").subtract(baseBefore));
        assertTrue(ledger.verifyConservation());
        try(var c=open.open();var p=c.prepareStatement(
            "SELECT maker_fee_bps,taker_fee_bps,buyer_fee_base,seller_fee_quote FROM paper_trades WHERE id=?")){
            p.setString(1,trade);
            try(var r=p.executeQuery()){
                assertTrue(r.next());
                assertEquals(10,r.getInt(1));assertEquals(25,r.getInt(2));
                eq("0.002",r.getBigDecimal(3));eq("0.055",r.getBigDecimal(4));
            }
        }
    }
    @Test void makerSellPaysMakerQuoteFeeBuyerPaysTakerBaseFee() {
        String buyer=id(),seller=id(),bid=id(),ask=id();
        ledger.creditForTest(id(),buyer,"USDC",n("100"));
        ledger.creditForTest(id(),seller,"BTC",n("2"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,n("10"),n("2"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,n("12"),n("2"));
        BigDecimal baseBefore=ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"BTC");
        BigDecimal quoteBefore=ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"USDC");
        assertTrue(settlement.settle(id(),ask,bid,n("2")));
        eq("1.995",ledger.balance(buyer,"BTC"));
        eq("19.98",ledger.balance(seller,"USDC"));
        eq("0.005",ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"BTC").subtract(baseBefore));
        eq("0.02",ledger.balance(PaperFeePolicy.FEE_ACCOUNT,"USDC").subtract(quoteBefore));
        eq("80",holds.balance(buyer,"USDC").available());
        assertTrue(ledger.verifyConservation());
    }
    @Test void conflictingRateOnTradeReplayRejectsWithoutMutation() {
        String buyer=id(),seller=id(),bid=id(),ask=id(),trade=id();
        ledger.creditForTest(id(),buyer,"USDC",n("100"));
        ledger.creditForTest(id(),seller,"BTC",n("1"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,n("10"),n("1"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,n("10"),n("1"));
        assertTrue(settlement.settle(trade,ask,bid,n("1")));
        PaperSettlementService changed=new PaperSettlementService(open,new PaperFeePolicy(11,25));
        assertThrows(IllegalArgumentException.class,()->changed.settle(trade,ask,bid,n("1")));
        eq("90",ledger.balance(buyer,"USDC"));
        assertTrue(ledger.verifyConservation());
    }
    @Test void noFeeBackwardCompatibleAndDustFeesAreZero() {
        var zero=new PaperFeePolicy(0,0).calculate(n("3"),n("30"),ExchangeCore.Side.BUY);
        eq("0",zero.buyerFeeBase());eq("0",zero.sellerFeeQuote());
        var dust=new PaperFeePolicy(10,25).calculate(n("0.000000000000000001"),
               n("0.000000000000000001"),ExchangeCore.Side.SELL);
        eq("0",dust.buyerFeeBase());eq("0",dust.sellerFeeQuote());
    }
    @Test void invalidRatesAndPrecisionFailBeforeMutation() {
        assertThrows(IllegalArgumentException.class,()->new PaperFeePolicy(-1,0));
        assertThrows(IllegalArgumentException.class,()->new PaperFeePolicy(1001,0));
        assertThrows(IllegalArgumentException.class,()->settlement.settle(id(),"bad","bad",n("-1")));
        assertThrows(IllegalArgumentException.class,()->new PaperFeePolicy(10,25)
           .calculate(n("0.0000000000000000001"),n("1"),ExchangeCore.Side.BUY));
    }
}
