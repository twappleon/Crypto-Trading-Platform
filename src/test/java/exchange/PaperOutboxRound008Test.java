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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import static org.junit.jupiter.api.Assertions.*;

/** Round 008: PAPER-only transactional outbox, lease and dedup BDD. */
class PaperOutboxRound008Test {
    static PostgresLedger.Connections open;
    static PostgresLedger ledger;
    static PaperOrderService orders;
    static PaperSettlementService settlement;
    static String id(){return "r008_"+UUID.randomUUID().toString().replace("-","");}
    static BigDecimal n(String x){return new BigDecimal(x);}
    record Fixture(String trade,String maker,String taker,String buyer,String seller) {}

    @BeforeAll static void init() throws Exception {
        String url=System.getenv("POSTGRES_JDBC_URL");
        if("1".equals(System.getenv("REQUIRE_POSTGRES_TESTS")))
            assertNotNull(url,"CI requires disposable PostgreSQL");
        else Assumptions.assumeTrue(url!=null,"no disposable PostgreSQL");
        String user=System.getenv().getOrDefault("POSTGRES_USER","paper");
        String pass=System.getenv().getOrDefault("POSTGRES_PASSWORD","paper");
        open=()->DriverManager.getConnection(url,user,pass);
        try(var c=open.open()){PostgresLedger.migrate(c);}
        ledger=new PostgresLedger(open);
        orders=new PaperOrderService(open);
        settlement=new PaperSettlementService(open);
    }
    static Fixture prepared(boolean cross){
        String buyer=id(),seller=id(),ask=id(),bid=id(),trade=id();
        ledger.creditForTest(id(),buyer,"USDC",n("100"));
        ledger.creditForTest(id(),seller,"BTC",n("2"));
        orders.place(ask,seller,"BTC","USDC",ExchangeCore.Side.SELL,n("10"),n("1"));
        orders.place(bid,buyer,"BTC","USDC",ExchangeCore.Side.BUY,n(cross?"11":"9"),n("1"));
        return new Fixture(trade,ask,bid,buyer,seller);
    }
    static int outboxCount(String trade) throws SQLException {
        try(var c=open.open();var p=c.prepareStatement(
                "SELECT count(*) FROM paper_trade_outbox WHERE trade_id=?")){
            p.setString(1,trade);
            try(var r=p.executeQuery()){assertTrue(r.next());return r.getInt(1);}
        }
    }
    @Test void committedTradeCreatesExactlyOneDurableEvent() throws Exception {
        Fixture f=prepared(true);
        assertTrue(settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        assertFalse(settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        assertEquals(1,outboxCount(f.trade()));
        var event=new PaperOutboxService(open).claim(f.trade()).orElseThrow();
        assertEquals(f.trade(),event.tradeId());
        assertEquals(f.maker(),event.makerId());
        assertEquals(f.taker(),event.takerId());
        assertEquals(0,event.executionPrice().compareTo(n("10")));
        assertEquals(0,event.quantity().compareTo(n("1")));
        assertTrue(ledger.verifyConservation());
    }
    @Test void rejectedSettlementRollsBackTradeAndOutbox() throws Exception {
        Fixture f=prepared(false);
        assertThrows(IllegalArgumentException.class,
            ()->settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        assertEquals(0,outboxCount(f.trade()));
        assertTrue(new PaperOutboxService(open).claim(f.trade()).isEmpty());
        assertEquals(0,ledger.balance(f.buyer(),"BTC").compareTo(n("0")));
        assertTrue(ledger.verifyConservation());
        try(var c=open.open();var p=c.prepareStatement(
                "INSERT INTO paper_trade_outbox(trade_id) VALUES (?)")){
            p.setString(1,f.trade());
            SQLException ex=assertThrows(SQLException.class,p::executeUpdate);
            assertEquals("23503",ex.getSQLState(),"foreign key blocks orphan delivery intent");
        }
    }
    @Test void staleOrWrongLeaseCannotAcknowledgeAndExpiredLeaseReplays() throws Exception {
        Fixture f=prepared(true);
        assertTrue(settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        var outbox=new PaperOutboxService(open);
        var first=outbox.claim(f.trade()).orElseThrow();
        assertTrue(outbox.claim(f.trade()).isEmpty(),"live lease exclusive");
        assertFalse(outbox.acknowledge(f.trade(),UUID.randomUUID().toString()));
        assertThrows(IllegalArgumentException.class,()->outbox.acknowledge(f.trade(),"bad"));
        try(var c=open.open();var p=c.prepareStatement(
                "UPDATE paper_trade_outbox SET claim_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE trade_id=?")){
            p.setString(1,f.trade());assertEquals(1,p.executeUpdate());
        }
        assertFalse(outbox.acknowledge(f.trade(),first.claimToken()),"expired token cannot ack");
        var replay=new PaperOutboxService(open).claim(f.trade()).orElseThrow();
        assertNotEquals(first.claimToken(),replay.claimToken());
        assertFalse(outbox.acknowledge(f.trade(),first.claimToken()),"superseded token fenced");
        assertTrue(outbox.acknowledge(f.trade(),replay.claimToken()));
        assertFalse(outbox.acknowledge(f.trade(),replay.claimToken()));
        assertTrue(outbox.claim(f.trade()).isEmpty(),"delivered never requeued");
    }
    @Test void consumerInboxDeduplicatesAfterRestart() throws Exception {
        Fixture f=prepared(true);
        assertTrue(settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        var first=new PaperOutboxService(open);
        assertTrue(first.recordConsumerReceipt("paper_projection",f.trade()));
        assertFalse(new PaperOutboxService(open).recordConsumerReceipt("paper_projection",f.trade()));
        assertTrue(first.recordConsumerReceipt("paper_audit",f.trade()));
        assertFalse(first.recordConsumerReceipt("paper_projection",id()),"nonexistent event not recorded");
        assertThrows(IllegalArgumentException.class,()->first.recordConsumerReceipt("../x",f.trade()));
    }
    @Test void concurrentWorkersCannotClaimSameLiveEvent() throws Exception {
        Fixture f=prepared(true);
        assertTrue(settlement.settle(f.trade(),f.maker(),f.taker(),n("1")));
        var pool=Executors.newFixedThreadPool(8);
        var start=new CountDownLatch(1);
        try {
            List<Future<Boolean>> futures=new ArrayList<>();
            for(int i=0;i<8;i++)futures.add(pool.submit(()->{
                start.await();
                return new PaperOutboxService(open).claim(f.trade()).isPresent();
            }));
            start.countDown();
            int won=0;
            for(var future:futures)if(future.get())won++;
            assertEquals(1,won,"SKIP LOCKED and live lease fence duplicate claims");
            assertEquals(1,outboxCount(f.trade()));
        }finally{pool.shutdownNow();}
    }
}
