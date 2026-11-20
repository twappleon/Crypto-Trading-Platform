package exchange;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Durable, paper-only available/locked balance reservations.
 * All mutations lock the parent account row; PostgresLedger.post locks the
 * same row before debits. The matching engine is NOT connected yet.
 */
public final class PaperHoldService {
    public record Balance(BigDecimal total, BigDecimal locked, BigDecimal available) {}
    private final PostgresLedger.Connections connections;

    public PaperHoldService(PostgresLedger.Connections connections) {
        this.connections = Objects.requireNonNull(connections);
    }

    private static void requireOwner(String owner) {
        PostgresLedger.requireAccount(owner);
        if ("treasury".equals(owner)) throw new IllegalArgumentException("treasury cannot place holds");
    }

    private static void requireId(String id) {
        if (id == null || !id.matches("[a-zA-Z0-9_:-]{1,96}"))
            throw new IllegalArgumentException("invalid hold ID");
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

    static BigDecimal locked(Connection c, String owner, String asset) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT COALESCE(SUM(amount), 0) FROM paper_ledger_holds " +
                "WHERE asset=? AND account_id=? AND state='ACTIVE'")) {
            p.setString(1, asset);
            p.setString(2, owner);
            try (ResultSet r = p.executeQuery()) {
                if (!r.next()) throw new SQLException("hold aggregate missing");
                return r.getBigDecimal(1);
            }
        }
    }

    /** @return true on first reservation; false for an identical reused ID. */
    public boolean reserve(String id, String owner, String asset, BigDecimal amount) {
        requireId(id);
        if (id.startsWith("order:"))
            throw new IllegalArgumentException("order collateral may only be changed by PaperOrderService");
        requireOwner(owner);
        PostgresLedger.requireAsset(asset);
        PostgresLedger.requirePositiveAmount(amount);
        BigDecimal normalized = amount.stripTrailingZeros();
        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            try {
                // Detect globally reused IDs before accessing the requested account:
                // a conflicting owner/asset must be classified as an ID conflict,
                // even if that owner has no funded paper account.
                try (PreparedStatement existing = c.prepareStatement(
                        "SELECT asset, account_id, amount FROM paper_ledger_holds WHERE id=?")) {
                    existing.setString(1, id);
                    try (ResultSet r = existing.executeQuery()) {
                        if (r.next()) {
                            if (!asset.equals(r.getString(1)) || !owner.equals(r.getString(2))
                                    || normalized.compareTo(r.getBigDecimal(3)) != 0)
                                throw new IllegalArgumentException("hold idempotency conflict");
                            c.rollback();
                            return false;
                        }
                    }
                }
                BigDecimal total = lockAccount(c, owner, asset);
                // The common account-row lock serializes reserve/release/debit operations.
                // Check an existing ID under the lock before evaluating available funds.
                boolean inserted;
                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO paper_ledger_holds(id,asset,account_id,amount) " +
                        "VALUES (?,?,?,?) ON CONFLICT (id) DO NOTHING")) {
                    // Availability must be checked before insertion; including this new
                    // hold in the aggregate would reject an otherwise valid reserve.
                    BigDecimal available = total.subtract(locked(c, owner, asset));
                    try (PreparedStatement existing = c.prepareStatement(
                            "SELECT asset, account_id, amount FROM paper_ledger_holds WHERE id=?")) {
                        existing.setString(1, id);
                        try (ResultSet r = existing.executeQuery()) {
                            if (r.next()) {
                                if (!asset.equals(r.getString(1)) || !owner.equals(r.getString(2))
                                        || normalized.compareTo(r.getBigDecimal(3)) != 0)
                                    throw new IllegalArgumentException("hold idempotency conflict");
                                c.rollback();
                                return false;
                            }
                        }
                    }
                    if (available.compareTo(normalized) < 0)
                        throw new IllegalStateException("insufficient available paper balance");
                    p.setString(1, id);
                    p.setString(2, asset);
                    p.setString(3, owner);
                    p.setBigDecimal(4, normalized);
                    inserted = p.executeUpdate() == 1;
                }
                if (!inserted) {
                    // A concurrent ID collision on a *different* account may have
                    // committed while this account was locked. Never treat it as success
                    // unless the immutable hold payload matches exactly.
                    try (PreparedStatement p = c.prepareStatement(
                            "SELECT asset,account_id,amount FROM paper_ledger_holds WHERE id=?")) {
                        p.setString(1, id);
                        try (ResultSet r = p.executeQuery()) {
                            if (!r.next() || !asset.equals(r.getString(1)) || !owner.equals(r.getString(2))
                                    || normalized.compareTo(r.getBigDecimal(3)) != 0)
                                throw new IllegalArgumentException("hold idempotency conflict");
                        }
                    }
                    c.rollback();
                    return false;
                }
                c.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rb) { e.addSuppressed(rb); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("paper hold SQL failure [SQLSTATE=" + e.getSQLState() + "]", e);
        }
    }

    /** @return true if newly released, false if already released. A release never credits a journal. */
    public boolean release(String id, String owner, String asset) {
        requireId(id);
        if (id.startsWith("order:"))
            throw new IllegalArgumentException("order collateral may only be changed by PaperOrderService");
        requireOwner(owner);
        PostgresLedger.requireAsset(asset);
        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            try {
                // Identity is immutable. Read it first, then lock the same parent
                // account row in the same global order as reserve() and ledger.post().
                try (PreparedStatement p = c.prepareStatement(
                        "SELECT asset, account_id FROM paper_ledger_holds WHERE id=?")) {
                    p.setString(1, id);
                    try (ResultSet r = p.executeQuery()) {
                        if (!r.next() || !asset.equals(r.getString(1)) || !owner.equals(r.getString(2)))
                            throw new IllegalArgumentException("unknown or unauthorized hold");
                    }
                }
                lockAccount(c, owner, asset);
                try (PreparedStatement p = c.prepareStatement(
                        "UPDATE paper_ledger_holds SET state='RELEASED', released_at=now() " +
                        "WHERE id=? AND asset=? AND account_id=? AND state='ACTIVE'")) {
                    p.setString(1, id);
                    p.setString(2, asset);
                    p.setString(3, owner);
                    boolean changed = p.executeUpdate() == 1;
                    c.commit();
                    return changed;
                }
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rb) { e.addSuppressed(rb); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("paper hold SQL failure [SQLSTATE=" + e.getSQLState() + "]", e);
        }
    }

    /** Consistent point-in-time snapshot. No chain funds, no spend authorization. */
    public Balance balance(String owner, String asset) {
        requireOwner(owner);
        PostgresLedger.requireAsset(asset);
        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            try {
                BigDecimal total = BigDecimal.ZERO;
                try (PreparedStatement p = c.prepareStatement(
                        "SELECT balance FROM paper_ledger_accounts WHERE asset=? AND account_id=?")) {
                    p.setString(1, asset);
                    p.setString(2, owner);
                    try (ResultSet r = p.executeQuery()) {
                        if (r.next()) total = r.getBigDecimal(1);
                    }
                }
                BigDecimal held = locked(c, owner, asset);
                c.commit();
                return new Balance(total, held, total.subtract(held));
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rb) { e.addSuppressed(rb); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("cannot read paper hold balance", e);
        }
    }
}
