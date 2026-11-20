-- PAPER-ONLY schema. No cryptocurrency wallets, custody, or real-money operations.
CREATE TABLE IF NOT EXISTS paper_ledger_accounts (
    asset VARCHAR(12) NOT NULL,
    account_id VARCHAR(96) NOT NULL,
    balance NUMERIC(38,18) NOT NULL DEFAULT 0,
    PRIMARY KEY (asset, account_id),
    CONSTRAINT nonnegative_user_paper_balance CHECK (account_id = 'treasury' OR balance >= 0)
);

CREATE TABLE IF NOT EXISTS paper_ledger_journals (
    id VARCHAR(96) PRIMARY KEY,
    asset VARCHAR(12) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, asset)
);

CREATE TABLE IF NOT EXISTS paper_ledger_entries (
    journal_id VARCHAR(96) NOT NULL,
    asset VARCHAR(12) NOT NULL,
    account_id VARCHAR(96) NOT NULL,
    delta NUMERIC(38,18) NOT NULL CHECK (delta <> 0),
    PRIMARY KEY (journal_id, account_id),
    FOREIGN KEY (journal_id, asset) REFERENCES paper_ledger_journals(id, asset) ON DELETE RESTRICT,
    FOREIGN KEY (asset, account_id) REFERENCES paper_ledger_accounts(asset, account_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_paper_ledger_entries_account
    ON paper_ledger_entries(asset, account_id, journal_id);
