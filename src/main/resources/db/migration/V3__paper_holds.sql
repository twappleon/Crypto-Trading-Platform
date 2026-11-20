-- Round 004. PAPER ONLY. Account totals remain journal-derived; holds only reserve spendable funds.
CREATE TABLE IF NOT EXISTS paper_ledger_holds (
    id VARCHAR(96) PRIMARY KEY,
    asset VARCHAR(12) NOT NULL,
    account_id VARCHAR(96) NOT NULL,
    amount NUMERIC(38,18) NOT NULL CHECK (amount > 0),
    state VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'RELEASED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ,
    CONSTRAINT paper_hold_account_fk FOREIGN KEY (asset, account_id)
        REFERENCES paper_ledger_accounts(asset, account_id) ON DELETE RESTRICT,
    CONSTRAINT paper_hold_release_time CHECK
        ((state = 'ACTIVE' AND released_at IS NULL)
          OR (state = 'RELEASED' AND released_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_paper_ledger_active_holds
    ON paper_ledger_holds(asset, account_id)
    WHERE state = 'ACTIVE';
