package exchange;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Round 005: durable PAPER limit-order intent and collateral reservation.
 * No matching, fills, market orders, external deposits or settlement occur here.
 * Order persistence and hold mutation share exactly one PostgreSQL transaction.
 */
public final class PaperOrderService {
    public record Ticket(String id, String owner, String baseAsset, String quoteAsset,
                         ExchangeCore.Side side, BigDecimal price, BigDecimal quantity,
                         String holdId, String heldAsset, BigDecimal reserved,
                         String state, BigDecimal remaining) {}
    private final PostgresLedger.Connections connections;

    public PaperOrderService(PostgresLedger.Connections connections) {
        this.connections = Objects.requireNonNull(connections);
    }

    private static void requireId(String id) {
        if (id == null || !id.matches("[a-zA-Z0-9_-]{1,80}"))
            throw new IllegalArgumentException("invalid order ID");
    }

    private static String holdId(String id) { return "order:" + id; }

    private static void check(String id, String owner, String base, String quote,
                              ExchangeCore.Side side, BigDecimal price, BigDecimal quantity) {
        requireId(id);
        PostgresLedger.requireAccount(owner);
        if ("treasury".equals(owner) || PaperFeePolicy.FEE_ACCOUNT.equals(owner))
            throw new IllegalArgumentException("internal system account cannot trade");
        PostgresLedger.requireAsset(base);
        PostgresLedger.requireAsset(quote);
        if (base.equals(quote) || side == null) throw new IllegalArgumentException("invalid market or side");
        PostgresLedger.requirePositiveAmount(price);
        PostgresLedger.requirePositiveAmount(quantity);
        // A BUY must reserve *full limit-price cost*, not the best visible ask.
        PostgresLedger.requirePositiveAmount(side == ExchangeCore.Side.BUY
                ? price.multiply(quantity) : quantity);
    }

    private static Ticket from(ResultSet r) throws SQLException {
        return new Ticket(r.getString("id"), r.getString("account_id"),
                r.getString("base_asset"), r.getString("quote_asset"),
                ExchangeCore.Side.valueOf(r.getString("side")),
                r.getBigDecimal("limit_price"), r.getBigDecimal("quantity"),
                r.getString("hold_id"), r.getString("held_asset"),
                r.getBigDecimal("reserved_amount"), r.getString("state"),
                r.getBigDecimal("remaining_quantity"));
    }

    private static Ticket read(Connection c, String id, boolean lock) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT * FROM paper_limit_orders WHERE id=?" + (lock ? " FOR UPDATE" : ""))) {
            p.setString(1, id);
            try (ResultSet r = p.executeQuery()) { return r.next() ? from(r) : null; }
        }
    }

    private static boolean same(Ticket old, String id, String owner, String base, String quote,
                                ExchangeCore.Side side, BigDecimal price, BigDecimal quantity) {
        return old.id().equals(id) && old.owner().equals(owner) && old.baseAsset().equals(base)
                && old.quoteAsset().equals(quote) && old.side() == side
                && old.price().compareTo(price) == 0 && old.quantity().compareTo(quantity) == 0;
    }

    private static BigDecimal lockAccount(Connection c, String owner, String asset) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT balance FROM paper_ledger_accounts WHERE asset=? AND account_id=? FOR UPDATE")) {
            p.setString(1, asset);
            p.setString(2, owner);
            try (ResultSet r = p.executeQuery()) {
                if (!r.next()) throw new IllegalStateException("insufficient available paper balance");
                return r.getBigDecimal(1);
            }
        }
    }

    /** @return true on first insertion; false on an identical retry (even if already canceled). */
    public boolean place(String id, String owner, String base, String quote,
                         ExchangeCore.Side side, BigDecimal price, BigDecimal quantity) {
        check(id, owner, base, quote, side, price, quantity);
        String asset = side == ExchangeCore.Side.BUY ? quote : base;
        BigDecimal amount = (side == ExchangeCore.Side.BUY ? price.multiply(quantity) : quantity)
                .stripTrailingZeros();
        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            try {
                Ticket existing = read(c, id, false);
                if (existing != null) {
                    if (!same(existing, id, owner, base, quote, side, price, quantity))
                        throw new IllegalArgumentException("order idempotency conflict");
                    c.rollback();
                    return false;
                }

                BigDecimal total = lockAccount(c, owner, asset);
                // After the account lock, recheck to handle concurrent same-owner retries.
                existing = read(c, id, false);
                if (existing != null) {
                    if (!same(existing, id, owner, base, quote, side, price, quantity))
                        throw new IllegalArgumentException("order idempotency conflict");
                    c.rollback();
                    return false;
                }
                if (total.subtract(PaperHoldService.locked(c, owner, asset)).compareTo(amount) < 0)
                    throw new IllegalStateException("insufficient available paper balance");

                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO paper_ledger_holds(id,asset,account_id,amount) " +
                        "VALUES (?,?,?,?) ON CONFLICT (id) DO NOTHING")) {
                    p.setString(1, holdId(id));
                    p.setString(2, asset);
                    p.setString(3, owner);
                    p.setBigDecimal(4, amount);
                    if (p.executeUpdate() != 1)
                        throw new IllegalArgumentException("order hold ID collision");
                }
                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO paper_limit_orders " +
                        "(id,account_id,base_asset,quote_asset,side,limit_price,quantity," +
                        "hold_id,held_asset,reserved_amount,remaining_quantity) VALUES (?,?,?,?,?,?,?,?,?,?,?) " +
                        "ON CONFLICT (id) DO NOTHING")) {
                    p.setString(1, id);
                    p.setString(2, owner);
                    p.setString(3, base);
                    p.setString(4, quote);
                    p.setString(5, side.name());
                    p.setBigDecimal(6, price.stripTrailingZeros());
                    p.setBigDecimal(7, quantity.stripTrailingZeros());
                    p.setString(8, holdId(id));
                    p.setString(9, asset);
                    p.setBigDecimal(10, amount);
                    p.setBigDecimal(11, quantity.stripTrailingZeros());
                    if (p.executeUpdate() != 1)
                        throw new IllegalArgumentException("order idempotency conflict");
                }
                c.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rb) { e.addSuppressed(rb); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("paper order SQL failure [SQLSTATE=" + e.getSQLState() + "]", e);
        }
    }

    /** Cancel OPEN order and release its specific hold atomically; repeated cancellation returns false. */
    public boolean cancel(String id, String owner) {
        requireId(id);
        PostgresLedger.requireAccount(owner);
        if ("treasury".equals(owner)) throw new IllegalArgumentException("invalid owner");
        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            try {
                Ticket initial = read(c, id, false);
                if (initial == null || !initial.owner().equals(owner))
                    throw new IllegalArgumentException("unknown or unauthorized order");
                // Same account-first lock order as place(), hold reserve/release and ledger debits.
                lockAccount(c, owner, initial.heldAsset());
                Ticket current = read(c, id, true);
                if (current == null || !current.owner().equals(owner))
                    throw new IllegalArgumentException("unknown or unauthorized order");
                if ("CANCELED".equals(current.state())) { c.rollback(); return false; }
                if (!"OPEN".equals(current.state()) && !"PARTIAL".equals(current.state()))
                    throw new IllegalStateException("order cannot be canceled in state " + current.state());
                try (PreparedStatement p = c.prepareStatement(
                        "UPDATE paper_ledger_holds SET state='RELEASED',released_at=now() " +
                        "WHERE id=? AND asset=? AND account_id=? AND state='ACTIVE'")) {
                    p.setString(1, current.holdId());
                    p.setString(2, current.heldAsset());
                    p.setString(3, owner);
                    if (p.executeUpdate() != 1)
                        throw new IllegalStateException("order collateral missing; cancel aborted");
                }
                try (PreparedStatement p = c.prepareStatement(
                        "UPDATE paper_limit_orders SET state='CANCELED',canceled_at=now() " +
                        "WHERE id=? AND state IN ('OPEN','PARTIAL')")) {
                    p.setString(1, id);
                    if (p.executeUpdate() != 1) throw new IllegalStateException("order state changed");
                }
                c.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rb) { e.addSuppressed(rb); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("paper order SQL failure [SQLSTATE=" + e.getSQLState() + "]", e);
        }
    }

    public Ticket get(String id, String owner) {
        requireId(id);
        PostgresLedger.requireAccount(owner);
        try (Connection c = connections.open()) {
            Ticket order = read(c, id, false);
            if (order == null || !order.owner().equals(owner))
                throw new IllegalArgumentException("unknown or unauthorized order");
            return order;
        } catch (SQLException e) {
            throw new IllegalStateException("cannot read paper order", e);
        }
    }
}
