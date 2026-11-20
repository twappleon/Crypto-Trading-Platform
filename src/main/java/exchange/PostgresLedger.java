package exchange;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/**
 * PostgreSQL-backed PAPER ledger. Every balanced journal and its balance updates
 * commit in one database transaction. This class never connects to a chain.
 *
 * Treasury can run negative only to fund synthetic test balances. Do not wire
 * the treasury to an unprivileged API or real custody infrastructure.
 */
public final class PostgresLedger {
    @FunctionalInterface
    public interface Connections { Connection open() throws SQLException; }

    private final Connections connections;

    public PostgresLedger(Connections connections) {
        this.connections = Objects.requireNonNull(connections);
    }

    /** Only for controlled setup/migrations, not for each transaction. */
    public static void migrate(Connection c) throws SQLException {
        String sql;
        try (var stream = PostgresLedger.class.getResourceAsStream("/db/migration/V1__paper_ledger.sql")) {
            if (stream == null) throw new IllegalStateException("paper ledger migration missing");
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("cannot read ledger migration", e);
        }
        try (Statement statement = c.createStatement()) {
            for (String part : sql.split(";")) {
                if (!part.isBlank()) statement.execute(part);
            }
        }
    }

    /**
     * @return true if newly posted, false if an identical journal ID was already posted.
     * @throws IllegalArgumentException for invalid or conflicting input.
     * @throws IllegalStateException for insufficient available balance or database failure.
     */
    public boolean post(String id, String asset, Map<String, BigDecimal> changes) {
        var deltas = validate(id, asset, changes);
        String fingerprint = fingerprint(asset, deltas);

        try (Connection c = connections.open()) {
            c.setAutoCommit(false);
            try {
                int inserted;
                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO paper_ledger_journals(id, asset, fingerprint) " +
                        "VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING")) {
                    p.setString(1, id);
                    p.setString(2, asset);
                    p.setString(3, fingerprint);
                    inserted = p.executeUpdate();
                }

                if (inserted == 0) {
                    try (PreparedStatement p = c.prepareStatement(
                            "SELECT asset, fingerprint FROM paper_ledger_journals WHERE id=?")) {
                        p.setString(1, id);
                        try (ResultSet r = p.executeQuery()) {
                            if (!r.next() || !asset.equals(r.getString(1))
                                    || !fingerprint.equals(r.getString(2)))
                                throw new IllegalArgumentException("journal idempotency conflict");
                        }
                    }
                    c.rollback();
                    return false;
                }

                // Canonical account order reduces deadlock risk for overlapping transfers.
                for (String account : deltas.keySet()) {
                    try (PreparedStatement p = c.prepareStatement(
                            "INSERT INTO paper_ledger_accounts(asset, account_id, balance) " +
                            "VALUES (?, ?, 0) ON CONFLICT (asset, account_id) DO NOTHING")) {
                        p.setString(1, asset);
                        p.setString(2, account);
                        p.executeUpdate();
                    }
                }

                // Lock accounts individually in a deterministic order, never based on
                // an optimizer-dependent multi-row SELECT ordering.
                for (var entry : deltas.entrySet()) {
                    try (PreparedStatement p = c.prepareStatement(
                            "SELECT balance FROM paper_ledger_accounts " +
                            "WHERE asset=? AND account_id=? FOR UPDATE")) {
                        p.setString(1, asset);
                        p.setString(2, entry.getKey());
                        try (ResultSet r = p.executeQuery()) {
                            if (!r.next()) throw new IllegalStateException("locked account missing");
                            BigDecimal next = r.getBigDecimal(1).add(entry.getValue());
                            if (!"treasury".equals(entry.getKey()) && next.signum() < 0)
                                throw new IllegalStateException("insufficient paper balance");
                        }
                    }
                }

                for (var entry : deltas.entrySet()) {
                    try (PreparedStatement p = c.prepareStatement(
                            "UPDATE paper_ledger_accounts SET balance=balance+? " +
                            "WHERE asset=? AND account_id=?")) {
                        p.setBigDecimal(1, entry.getValue());
                        p.setString(2, asset);
                        p.setString(3, entry.getKey());
                        if (p.executeUpdate() != 1) throw new SQLException("account update missing");
                    }
                    try (PreparedStatement p = c.prepareStatement(
                            "INSERT INTO paper_ledger_entries(journal_id, asset, account_id, delta) " +
                            "VALUES (?, ?, ?, ?)")) {
                        p.setString(1, id);
                        p.setString(2, asset);
                        p.setString(3, entry.getKey());
                        p.setBigDecimal(4, entry.getValue());
                        p.executeUpdate();
                    }
                }
                c.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rollback) { e.addSuppressed(rollback); }
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("paper ledger SQL transaction failed", e);
        }
    }

    public BigDecimal balance(String account, String asset) {
        requireAccount(account);
        requireAsset(asset);
        try (Connection c = connections.open();
             PreparedStatement p = c.prepareStatement(
                     "SELECT balance FROM paper_ledger_accounts WHERE asset=? AND account_id=?")) {
            p.setString(1, asset);
            p.setString(2, account);
            try (ResultSet r = p.executeQuery()) {
                return r.next() ? r.getBigDecimal(1) : BigDecimal.ZERO;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("cannot read paper ledger balance", e);
        }
    }

    public boolean creditForTest(String id, String account, String asset, BigDecimal amount) {
        requireAccount(account);
        if ("treasury".equals(account)) throw new IllegalArgumentException("reserved account");
        requirePositiveAmount(amount);
        return post(id, asset, Map.of("treasury", amount.negate(), account, amount));
    }

    public boolean transfer(String id, String from, String to, String asset, BigDecimal amount) {
        requireAccount(from);
        requireAccount(to);
        if (from.equals(to) || "treasury".equals(from) || "treasury".equals(to))
            throw new IllegalArgumentException("invalid sender or receiver");
        requirePositiveAmount(amount);
        return post(id, asset, Map.of(from, amount.negate(), to, amount));
    }

    static TreeMap<String, BigDecimal> validate(String id, String asset,
                                                 Map<String, BigDecimal> changes) {
        if (id == null || !id.matches("[a-zA-Z0-9_:-]{1,96}"))
            throw new IllegalArgumentException("invalid journal ID");
        requireAsset(asset);
        if (changes == null || changes.size() < 2)
            throw new IllegalArgumentException("journal needs at least two accounts");
        TreeMap<String, BigDecimal> ordered = new TreeMap<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (var entry : changes.entrySet()) {
            requireAccount(entry.getKey());
            BigDecimal delta = entry.getValue();
            checkAmount(delta);
            if (delta.signum() == 0) throw new IllegalArgumentException("zero-value entry");
            BigDecimal canonical = delta.stripTrailingZeros();
            ordered.put(entry.getKey(), canonical);
            sum = sum.add(canonical);
        }
        if (sum.signum() != 0) throw new IllegalArgumentException("unbalanced journal");
        return ordered;
    }

    private static String fingerprint(String asset, TreeMap<String, BigDecimal> sorted) {
        StringBuilder body = new StringBuilder(asset.length() + 20);
        body.append(asset.length()).append(':').append(asset);
        sorted.forEach((account, amount) -> body.append('|').append(account.length())
                .append(':').append(account).append('=').append(amount.toPlainString()));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(body.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static void requireAccount(String account) {
        if (account == null || !account.matches("[a-zA-Z0-9_-]{1,96}"))
            throw new IllegalArgumentException("invalid account");
    }
    private static void requireAsset(String asset) {
        if (asset == null || !asset.matches("[A-Z0-9]{2,12}"))
            throw new IllegalArgumentException("invalid asset");
    }
    private static void requirePositiveAmount(BigDecimal amount) {
        checkAmount(amount);
        if (amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
    }
    private static void checkAmount(BigDecimal amount) {
        if (amount == null) throw new IllegalArgumentException("null amount");
        BigDecimal n = amount.stripTrailingZeros();
        int fractionalDigits = Math.max(0, n.scale());
        int integerDigits = Math.max(0, n.precision() - n.scale());
        if (fractionalDigits > 18 || integerDigits > 20)
            throw new IllegalArgumentException("exceeds NUMERIC(38,18) precision");
    }
}
