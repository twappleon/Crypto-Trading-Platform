package exchange;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/**
 * Round 006: Explicit-pair, PAPER-only, atomic settlement primitive.
 * Not an automated price/time sequencer and not a public trading endpoint.
 * Caller must pick maker/taker in a separate deterministic matching round.
 */
public final class PaperSettlementService {
    private final PostgresLedger.Connections connections;
    private final PaperFeePolicy feePolicy;

    /** Compatibility defaults to no PAPER fees; configure explicitly for a demo market. */
    public PaperSettlementService(PostgresLedger.Connections connections) {
        this(connections, new PaperFeePolicy(0, 0));
    }
    public PaperSettlementService(PostgresLedger.Connections connections, PaperFeePolicy feePolicy) {
        this.connections = Objects.requireNonNull(connections);
        this.feePolicy = Objects.requireNonNull(feePolicy);
    }

    private record Order(String id, String owner, String base, String quote,
                         ExchangeCore.Side side, BigDecimal price,
                         BigDecimal remaining, String holdId, String state) {}
    private record Account(String asset, String owner) implements Comparable<Account> {
        @Override public int compareTo(Account other) {
            int a=asset.compareTo(other.asset);
            return a!=0?a:owner.compareTo(other.owner);
        }
    }
    private record Receipt(String maker, String taker, BigDecimal quantity,
                           int makerBps, int takerBps) {}

    private static void requireId(String id) {
        if (id == null || !id.matches("[a-zA-Z0-9_-]{1,80}"))
            throw new IllegalArgumentException("invalid paper trade/order ID");
    }
    private static Order order(Connection c, String id, boolean lock) throws SQLException {
        try (PreparedStatement p=c.prepareStatement(
                "SELECT id,account_id,base_asset,quote_asset,side,limit_price,remaining_quantity,hold_id,state " +
                "FROM paper_limit_orders WHERE id=?" + (lock?" FOR UPDATE":""))) {
            p.setString(1,id);
            try (ResultSet r=p.executeQuery()) {
                if (!r.next()) throw new IllegalArgumentException("unknown order");
                return new Order(r.getString(1),r.getString(2),r.getString(3),r.getString(4),
                        ExchangeCore.Side.valueOf(r.getString(5)),r.getBigDecimal(6),
                        r.getBigDecimal(7),r.getString(8),r.getString(9));
            }
        }
    }
    private static Receipt receipt(Connection c,String id) throws SQLException {
        try (PreparedStatement p=c.prepareStatement(
                "SELECT maker_order_id,taker_order_id,quantity,maker_fee_bps,taker_fee_bps FROM paper_trades WHERE id=?")) {
            p.setString(1,id);
            try(ResultSet r=p.executeQuery()) {
                return r.next()?new Receipt(r.getString(1),r.getString(2),r.getBigDecimal(3),
                        r.getInt(4),r.getInt(5)):null;
            }
        }
    }
    private boolean same(Receipt r,String maker,String taker,BigDecimal qty) {
        return r.maker.equals(maker)&&r.taker.equals(taker)&&r.quantity.compareTo(qty)==0
                &&r.makerBps==feePolicy.makerBps()&&r.takerBps==feePolicy.takerBps();
    }
    private static Map<String,BigDecimal> netOfFee(String payer,String receiver,
                                                   BigDecimal gross,BigDecimal fee) {
        TreeMap<String,BigDecimal> delta=new TreeMap<>();
        delta.put(payer,gross.negate());
        delta.put(receiver,gross.subtract(fee));
        if(fee.signum()>0)delta.put(PaperFeePolicy.FEE_ACCOUNT,fee);
        return delta;
    }
    private static void pair(Order maker,Order taker) {
        if (maker.id.equals(taker.id)||maker.side==taker.side
                ||!maker.base.equals(taker.base)||!maker.quote.equals(taker.quote))
            throw new IllegalArgumentException("invalid crossed pair");
        if (maker.owner.equals(taker.owner))
            throw new IllegalArgumentException("self-trade forbidden");
        Order buy=maker.side==ExchangeCore.Side.BUY?maker:taker;
        Order sell=maker.side==ExchangeCore.Side.SELL?maker:taker;
        if (buy.price.compareTo(sell.price)<0)
            throw new IllegalArgumentException("uncrossed prices");
    }
    private static void ensureAccount(Connection c, Account a) throws SQLException {
        try(PreparedStatement p=c.prepareStatement(
                "INSERT INTO paper_ledger_accounts(asset,account_id,balance) VALUES (?,?,0) " +
                "ON CONFLICT (asset,account_id) DO NOTHING")) {
            p.setString(1,a.asset);p.setString(2,a.owner);p.executeUpdate();
        }
    }
    private static void lockAccount(Connection c, Account a) throws SQLException {
        try(PreparedStatement p=c.prepareStatement(
                "SELECT balance FROM paper_ledger_accounts WHERE asset=? AND account_id=? FOR UPDATE")) {
            p.setString(1,a.asset);p.setString(2,a.owner);
            try(ResultSet r=p.executeQuery()) {
                if(!r.next())throw new IllegalStateException("paper account missing");
            }
        }
    }
    private static BigDecimal remainingHold(Order o,BigDecimal qty) {
        BigDecimal left=o.remaining.subtract(qty);
        if(left.signum()<0)throw new IllegalArgumentException("trade exceeds remaining quantity");
        BigDecimal amount=o.side==ExchangeCore.Side.BUY?o.price.multiply(left):left;
        if(amount.signum()>0)PostgresLedger.requirePositiveAmount(amount);
        return amount;
    }
    private static void consumeHold(Connection c,Order o,BigDecimal filled) throws SQLException {
        BigDecimal expected=o.side==ExchangeCore.Side.BUY?o.price.multiply(o.remaining):o.remaining;
        BigDecimal next=remainingHold(o,filled);
        String asset=o.side==ExchangeCore.Side.BUY?o.quote:o.base;
        try (PreparedStatement p=c.prepareStatement(
                "SELECT asset,account_id,amount,state FROM paper_ledger_holds WHERE id=? FOR UPDATE")) {
            p.setString(1,o.holdId);
            try(ResultSet r=p.executeQuery()){
                if(!r.next()||!"ACTIVE".equals(r.getString(4))
                        ||!o.owner.equals(r.getString(2))||!asset.equals(r.getString(1))
                        ||expected.compareTo(r.getBigDecimal(3))!=0)
                    throw new IllegalStateException("paper collateral mismatch");
            }
        }
        if(next.signum()==0) {
            try(PreparedStatement p=c.prepareStatement(
                    "UPDATE paper_ledger_holds SET state='RELEASED',released_at=now() " +
                    "WHERE id=? AND state='ACTIVE'")){
                p.setString(1,o.holdId);
                if(p.executeUpdate()!=1)throw new IllegalStateException("hold already released");
            }
        } else {
            try(PreparedStatement p=c.prepareStatement(
                    "UPDATE paper_ledger_holds SET amount=? WHERE id=? AND state='ACTIVE'")){
                p.setBigDecimal(1,next);p.setString(2,o.holdId);
                if(p.executeUpdate()!=1)throw new IllegalStateException("hold not active");
            }
        }
    }
    private static void updateOrder(Connection c,Order o,BigDecimal filled) throws SQLException {
        BigDecimal left=o.remaining.subtract(filled);
        String state=left.signum()==0?"FILLED":"PARTIAL";
        try(PreparedStatement p=c.prepareStatement(
                "UPDATE paper_limit_orders SET remaining_quantity=?,state=? WHERE id=? AND state IN ('OPEN','PARTIAL')")){
            p.setBigDecimal(1,left);p.setString(2,state);p.setString(3,o.id);
            if(p.executeUpdate()!=1)throw new IllegalStateException("order state changed during fill");
        }
    }

    /**
     * Post balanced journal within the CALLER'S transaction. Accounts must
     * already be locked in canonical (asset, account) order.
     */
    private static void journal(Connection c,String id,String asset,Map<String,BigDecimal> changes)
            throws SQLException {
        TreeMap<String,BigDecimal> delta=PostgresLedger.validate(id,asset,changes);
        // Internal journals have immutable, unique trade-scoped IDs. Duplicate
        // trade IDs are checked separately; do not silently double-credit.
        String fingerprint=PostgresLedger.fingerprint(asset,delta);
        try(PreparedStatement p=c.prepareStatement(
                "INSERT INTO paper_ledger_journals(id,asset,fingerprint) VALUES (?,?,?)")){
            p.setString(1,id);p.setString(2,asset);p.setString(3,fingerprint);
            p.executeUpdate();
        }
        for(var d:delta.entrySet()){
            try(PreparedStatement p=c.prepareStatement(
                    "UPDATE paper_ledger_accounts SET balance=balance+? " +
                    "WHERE asset=? AND account_id=? AND (account_id='treasury' OR balance+? >= 0)")){
                p.setBigDecimal(1,d.getValue());p.setString(2,asset);p.setString(3,d.getKey());
                p.setBigDecimal(4,d.getValue());
                if(p.executeUpdate()!=1)throw new IllegalStateException("paper balance would be negative");
            }
            try(PreparedStatement p=c.prepareStatement(
                    "INSERT INTO paper_ledger_entries(journal_id,asset,account_id,delta) VALUES (?,?,?,?)")){
                p.setString(1,id);p.setString(2,asset);p.setString(3,d.getKey());p.setBigDecimal(4,d.getValue());
                p.executeUpdate();
            }
        }
        for(String owner:delta.keySet()){
            if(!"treasury".equals(owner)){
                try(PreparedStatement p=c.prepareStatement(
                        "SELECT balance FROM paper_ledger_accounts WHERE asset=? AND account_id=?")){
                    p.setString(1,asset);p.setString(2,owner);
                    try(ResultSet r=p.executeQuery()){
                        if(!r.next()||r.getBigDecimal(1).compareTo(PaperHoldService.locked(c,owner,asset))<0)
                            throw new IllegalStateException("paper balance below remaining holds");
                    }
                }
            }
        }
    }

    /**
     * @return true if posted, false if same trade ID and payload already posted.
     * A reused trade ID with different intent is rejected. No real funds.
     */
    public boolean settle(String tradeId,String makerId,String takerId,BigDecimal quantity) {
        requireId(tradeId);requireId(makerId);requireId(takerId);
        if(makerId.equals(takerId))throw new IllegalArgumentException("same order");
        PostgresLedger.requirePositiveAmount(quantity);
        // Prefix plus suffix must fit ledger journal's 96-character key.
        String baseJournal="trade:"+tradeId+":base";
        String quoteJournal="trade:"+tradeId+":quote";
        try(Connection c=connections.open()){
            c.setAutoCommit(false);
            try {
                Receipt existing=receipt(c,tradeId);
                if(existing!=null){
                    if(!same(existing,makerId,takerId,quantity))
                        throw new IllegalArgumentException("trade idempotency conflict");
                    c.rollback();return false;
                }
                Order initialMaker=order(c,makerId,false);
                Order initialTaker=order(c,takerId,false);
                pair(initialMaker,initialTaker);
                Order buy=initialMaker.side==ExchangeCore.Side.BUY?initialMaker:initialTaker;
                Order sell=initialMaker.side==ExchangeCore.Side.SELL?initialMaker:initialTaker;

                PaperFeePolicy.Fees planned=feePolicy.calculate(quantity,
                        initialMaker.price.multiply(quantity),initialMaker.side);
                List<Account> accounts=new ArrayList<>(List.of(
                        new Account(buy.base,buy.owner),new Account(buy.quote,buy.owner),
                        new Account(sell.base,sell.owner),new Account(sell.quote,sell.owner)));
                if(planned.buyerFeeBase().signum()>0)
                    accounts.add(new Account(buy.base,PaperFeePolicy.FEE_ACCOUNT));
                if(planned.sellerFeeQuote().signum()>0)
                    accounts.add(new Account(sell.quote,PaperFeePolicy.FEE_ACCOUNT));
                accounts.sort(Account::compareTo);
                for(Account a:accounts)ensureAccount(c,a);
                for(Account a:accounts)lockAccount(c,a);
                // Account locks precede order row locks, consistent with cancel().
                String first=makerId.compareTo(takerId)<0?makerId:takerId;
                String second=makerId.compareTo(takerId)<0?takerId:makerId;
                Order o1=order(c,first,true);
                Order o2=order(c,second,true);
                Order maker=makerId.equals(first)?o1:o2;
                Order taker=takerId.equals(first)?o1:o2;

                existing=receipt(c,tradeId); // concurrent id retry, after serialized locks
                if(existing!=null){
                    if(!same(existing,makerId,takerId,quantity))
                        throw new IllegalArgumentException("trade idempotency conflict");
                    c.rollback();return false;
                }
                pair(maker,taker);
                if(!("OPEN".equals(maker.state)||"PARTIAL".equals(maker.state))
                        ||!("OPEN".equals(taker.state)||"PARTIAL".equals(taker.state)))
                    throw new IllegalStateException("cannot fill inactive order");
                if(quantity.compareTo(maker.remaining)>0||quantity.compareTo(taker.remaining)>0)
                    throw new IllegalArgumentException("trade exceeds remaining quantity");

                BigDecimal cost=maker.price.multiply(quantity);
                PostgresLedger.requirePositiveAmount(cost);
                PaperFeePolicy.Fees fees=feePolicy.calculate(quantity,cost,maker.side);
                buy=maker.side==ExchangeCore.Side.BUY?maker:taker;
                sell=maker.side==ExchangeCore.Side.SELL?maker:taker;
                consumeHold(c,maker,quantity);
                consumeHold(c,taker,quantity);
                journal(c,baseJournal,maker.base,
                        netOfFee(sell.owner,buy.owner,quantity,fees.buyerFeeBase()));
                journal(c,quoteJournal,maker.quote,
                        netOfFee(buy.owner,sell.owner,cost,fees.sellerFeeQuote()));
                updateOrder(c,maker,quantity);
                updateOrder(c,taker,quantity);
                try(PreparedStatement p=c.prepareStatement(
                        "INSERT INTO paper_trades(id,maker_order_id,taker_order_id,base_asset,quote_asset," +
                        "execution_price,quantity,buyer_account,seller_account,maker_fee_bps,taker_fee_bps," +
                    "buyer_fee_base,seller_fee_quote) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")){
                    p.setString(1,tradeId);p.setString(2,makerId);p.setString(3,takerId);
                    p.setString(4,maker.base);p.setString(5,maker.quote);
                    p.setBigDecimal(6,maker.price);p.setBigDecimal(7,quantity);
                    p.setString(8,buy.owner);p.setString(9,sell.owner);
                    p.setInt(10,feePolicy.makerBps());p.setInt(11,feePolicy.takerBps());
                    p.setBigDecimal(12,fees.buyerFeeBase());p.setBigDecimal(13,fees.sellerFeeQuote());
                    p.executeUpdate();
                }
                c.commit();return true;
            }catch(SQLException|RuntimeException e){
                try{c.rollback();}catch(SQLException rb){e.addSuppressed(rb);}
                throw e;
            }
        }catch(SQLException e){
            throw new IllegalStateException("paper settlement SQL failure [SQLSTATE="+e.getSQLState()+"]",e);
        }
    }
}
