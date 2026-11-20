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
        // Disposable test-schema bootstrap. V2 uses explicit statement boundaries
        // because PostgreSQL function bodies legitimately contain semicolons.
        for (String path : java.util.List.of(
                "/db/migration/V1__paper_ledger.sql",
                "/db/migration/V2__paper_ledger_guards.sql")) {
            String sql;
            try (var stream = PostgresLedger.class.getResourceAsStream(path)) {
                if (stream == null) throw new IllegalStateException("paper ledger migration missing: " + path);
                sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new IllegalStateException("cannot read ledger migration", e);
            }
            try (Statement statement = c.createStatement()) {
                String[] statements = path.contains("/V2__")
                        ? sql.split("(?m)^-- @statement\\s*$") : sql.split(";");
                for (String part : statements) {
                    if (!part.isBlank()) statement.execute(part);
                }
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
            throw new SqlFailure(e);
        }
    }

    /**
     * Only SQLSTATE 40001 (serialization) and 40P01 (deadlock) are retried.
     * The immutable journal ID is reused on each attempt. Uncertain commits,
     * e.g. SQLSTATE 08006, fail closed rather than blindly replaying a debit.
     */
    public boolean postWithRetry(String id, String asset, Map<String, BigDecimal> changes, int maxAttempts) {
        if (maxAttempts < 1 || maxAttempts > 5)
            throw new IllegalArgumentException("maxAttempts must be 1..5");
        for (int attempt = 1; ; attempt++) {
            try {
                return post(id, asset, changes);
            } catch (SqlFailure e) {
                if (!e.retryable() || attempt == maxAttempts) throw e;
                try {
                    Thread.sleep(10L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("retry interrupted; outcome requires reconciliation", interrupted);
                }
            }
        }
    }

    public static final class SqlFailure extends IllegalStateException {
        private final String sqlState;
        private SqlFailure(SQLException cause) {
            super("paper ledger SQL transaction failed [SQLSTATE=" + cause.getSQLState() + "]", cause);
            this.sqlState = cause.getSQLState();
        }
        public String sqlState() { return sqlState; }
        public boolean retryable() { return retryableSqlState(sqlState); }
    }

    static boolean retryableSqlState(String sqlState) {
        return "40001".equals(sqlState) || "40P01".equals(sqlState);
    }

    /**
     * Read-only DB-side audit: detect empty/unbalanced journals OR balances
     * that differ from the sum of immutable entries. This is not a repair API.
     */
    public boolean verifyConservation() {
        String sql = """
            SELECT
              (SELECT COUNT(*) FROM paper_ledger_journals j
               LEFT JOIN (
                 SELECT journal_id, COUNT(*) AS n, SUM(delta) AS total
                   FROM paper_ledger_entries GROUP BY journal_id
               ) e ON e.journal_id = j.id
               WHERE COALESCE(e.n, 0) < 2 OR COALESCE(e.total, 0) <> 0)
              +
              (SELECT COUNT(*) FROM paper_ledger_accounts a
               LEFT JOIN (
                 SELECT asset, account_id, SUM(delta) AS total
                   FROM paper_ledger_entries GROUP BY asset, account_id
               ) e ON e.asset = a.asset AND e.account_id = a.account_id
               WHERE a.balance <> COALESCE(e.total, 0))
            """;
        try (Connection c = connections.open();
             PreparedStatement p = c.prepareStatement(sql);
             ResultSet r = p.executeQuery()) {
            if (!r.next()) throw new IllegalStateException("conservation audit missing result");
            return r.getLong(1) == 0L;
        } catch (SQLException e) {
            throw new SqlFailure(e);
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
