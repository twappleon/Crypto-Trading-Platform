-- Round 008: durable PAPER trade event outbox; never publish live funds.
-- Rows are created in the SAME transaction as paper_trades and two asset journals.
-- Lease/ack protocol guarantees at-least-once delivery, not exactly-once side effects.
CREATE TABLE IF NOT EXISTS paper_trade_outbox (
    trade_id VARCHAR(80) PRIMARY KEY REFERENCES paper_trades(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    claim_token UUID,
    claim_expires_at TIMESTAMPTZ,
    claim_attempts INTEGER NOT NULL DEFAULT 0 CHECK (claim_attempts >= 0),
    delivered_at TIMESTAMPTZ,
    CONSTRAINT paper_outbox_claim_pair CHECK (
        (claim_token IS NULL AND claim_expires_at IS NULL)
        OR (claim_token IS NOT NULL AND claim_expires_at IS NOT NULL)
    )
);
-- @statement
CREATE INDEX IF NOT EXISTS idx_paper_trade_outbox_ready
    ON paper_trade_outbox(created_at,trade_id) WHERE delivered_at IS NULL;
-- @statement
CREATE TABLE IF NOT EXISTS paper_trade_consumer_inbox (
    consumer_id VARCHAR(80) NOT NULL,
    trade_id VARCHAR(80) NOT NULL REFERENCES paper_trade_outbox(trade_id) ON DELETE RESTRICT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (consumer_id,trade_id)
);
