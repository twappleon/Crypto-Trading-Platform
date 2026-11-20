package exchange;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Round 008: PAPER-only transactional outbox delivery protocol.
 * Claiming does not send anything to a network. An eventual transport must
 * treat delivery as AT-LEAST-ONCE and commit its own side effect with inbox
 * deduplication. There is no real-money integration here.
 */
public final class PaperOutboxService {
    public record Event(String tradeId, String makerId, String takerId,
                        BigDecimal executionPrice, BigDecimal quantity,
                        String claimToken) {}
    private final PostgresLedger.Connections connections;

    public PaperOutboxService(PostgresLedger.Connections connections) {
        this.connections=Objects.requireNonNull(connections);
    }
    private static void requireId(String id) {
        if(id==null||!id.matches("[a-zA-Z0-9_-]{1,80}"))
            throw new IllegalArgumentException("invalid PAPER outbox identifier");
    }

    /** Claim next eligible event for one minute. Multiple workers use SKIP LOCKED. */
    public Optional<Event> claimNext() { return claimInternal(null); }

    /** Select a particular event for deterministic replay/BDD (same lease rules). */
    public Optional<Event> claim(String tradeId) {
        requireId(tradeId);
        return claimInternal(tradeId);
    }

    private Optional<Event> claimInternal(String onlyId) {
        try(Connection c=connections.open()){
            c.setAutoCommit(false);
            try {
                String sql="SELECT o.trade_id,t.maker_order_id,t.taker_order_id,"+
                    "t.execution_price,t.quantity FROM paper_trade_outbox o "+
                    "JOIN paper_trades t ON t.id=o.trade_id "+
                    "WHERE o.delivered_at IS NULL "+
                    "AND (o.claim_expires_at IS NULL OR o.claim_expires_at <= clock_timestamp()) "+
                    (onlyId==null?"":"AND o.trade_id=? ")+
                    "ORDER BY o.created_at,o.trade_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED";
                String trade,maker,taker;
                BigDecimal price,qty;
                try(PreparedStatement p=c.prepareStatement(sql)){
                    if(onlyId!=null)p.setString(1,onlyId);
                    try(ResultSet r=p.executeQuery()){
                        if(!r.next()){c.rollback();return Optional.empty();}
                        trade=r.getString(1);maker=r.getString(2);taker=r.getString(3);
                        price=r.getBigDecimal(4);qty=r.getBigDecimal(5);
                    }
                }
                UUID token=UUID.randomUUID();
                try(PreparedStatement p=c.prepareStatement(
                    "UPDATE paper_trade_outbox SET claim_token=?, "+
                    "claim_expires_at=clock_timestamp()+INTERVAL '60 seconds',"+
                    "claim_attempts=claim_attempts+1 WHERE trade_id=? AND delivered_at IS NULL")){
                    p.setObject(1,token);p.setString(2,trade);
                    if(p.executeUpdate()!=1)throw new IllegalStateException("outbox claim changed");
                }
                c.commit();
                return Optional.of(new Event(trade,maker,taker,price,qty,token.toString()));
            }catch(SQLException|RuntimeException e){
                try{c.rollback();}catch(SQLException rb){e.addSuppressed(rb);}
                throw e;
            }
        }catch(SQLException e){
            throw new IllegalStateException("PAPER outbox SQL failure [SQLSTATE="+e.getSQLState()+"]",e);
        }
    }

    /**
     * Mark delivered only for the currently live lease. Repeated or stale ACK
     * returns false. A transport MUST NOT assume this makes external delivery
     * exactly-once; reconnect/replay can still duplicate outbound messages.
     */
    public boolean acknowledge(String tradeId,String claimToken) {
        requireId(tradeId);
        UUID token;
        try { token=UUID.fromString(claimToken); }
        catch(IllegalArgumentException|NullPointerException e){
            throw new IllegalArgumentException("invalid claim token",e);
        }
        try(Connection c=connections.open();PreparedStatement p=c.prepareStatement(
            "UPDATE paper_trade_outbox SET delivered_at=clock_timestamp() "+
            "WHERE trade_id=? AND claim_token=? AND claim_expires_at>clock_timestamp() "+
            "AND delivered_at IS NULL")){
            p.setString(1,tradeId);p.setObject(2,token);
            return p.executeUpdate()==1;
        }catch(SQLException e){
            throw new IllegalStateException("PAPER outbox ack SQL failure",e);
        }
    }

    /**
     * Durable consumer-side deduplication marker. The consumer must put its
     * OWN side effect in the same local transaction as this insert; this
     * standalone marker is only demonstrative and is not a broker/transport.
     */
    public boolean recordConsumerReceipt(String consumerId,String tradeId) {
        requireId(consumerId);requireId(tradeId);
        try(Connection c=connections.open();PreparedStatement p=c.prepareStatement(
            "INSERT INTO paper_trade_consumer_inbox(consumer_id,trade_id) "+
            "SELECT ?,trade_id FROM paper_trade_outbox WHERE trade_id=? "+
            "ON CONFLICT (consumer_id,trade_id) DO NOTHING")){
            p.setString(1,consumerId);p.setString(2,tradeId);
            return p.executeUpdate()==1;
        }catch(SQLException e){
            throw new IllegalStateException("PAPER inbox SQL failure",e);
        }
    }
}
