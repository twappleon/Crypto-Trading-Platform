-- Round 006: PAPER only, settlement lifecycle and immutable trade receipts.
-- Safe re-run on disposable test schema, NOT a production migration process.
ALTER TABLE paper_limit_orders ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC(38,18);
-- @statement
UPDATE paper_limit_orders SET remaining_quantity=quantity WHERE remaining_quantity IS NULL;
-- @statement
ALTER TABLE paper_limit_orders ALTER COLUMN remaining_quantity SET NOT NULL;
-- @statement
ALTER TABLE paper_limit_orders DROP CONSTRAINT IF EXISTS paper_limit_orders_state_check;
-- @statement
ALTER TABLE paper_limit_orders ADD CONSTRAINT paper_limit_orders_state_check
    CHECK (state IN ('OPEN','PARTIAL','FILLED','CANCELED'));
-- @statement
ALTER TABLE paper_limit_orders DROP CONSTRAINT IF EXISTS paper_order_cancel_time;
-- @statement
ALTER TABLE paper_limit_orders ADD CONSTRAINT paper_order_cancel_time CHECK (
    (state='CANCELED' AND canceled_at IS NOT NULL)
    OR (state<>'CANCELED' AND canceled_at IS NULL)
);
-- @statement
ALTER TABLE paper_limit_orders DROP CONSTRAINT IF EXISTS paper_order_remaining_valid;
-- @statement
ALTER TABLE paper_limit_orders ADD CONSTRAINT paper_order_remaining_valid CHECK (
    remaining_quantity >= 0 AND remaining_quantity <= quantity
    AND ((state='OPEN' AND remaining_quantity=quantity)
      OR (state='PARTIAL' AND remaining_quantity>0 AND remaining_quantity<quantity)
      OR (state='FILLED' AND remaining_quantity=0)
      OR (state='CANCELED' AND remaining_quantity>0))
);
-- @statement
CREATE TABLE IF NOT EXISTS paper_trades (
    id VARCHAR(80) PRIMARY KEY,
    maker_order_id VARCHAR(80) NOT NULL REFERENCES paper_limit_orders(id) ON DELETE RESTRICT,
    taker_order_id VARCHAR(80) NOT NULL REFERENCES paper_limit_orders(id) ON DELETE RESTRICT,
    base_asset VARCHAR(12) NOT NULL,
    quote_asset VARCHAR(12) NOT NULL,
    execution_price NUMERIC(38,18) NOT NULL CHECK (execution_price>0),
    quantity NUMERIC(38,18) NOT NULL CHECK (quantity>0),
    buyer_account VARCHAR(96) NOT NULL,
    seller_account VARCHAR(96) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (maker_order_id <> taker_order_id),
    CHECK (buyer_account <> seller_account)
);
-- @statement
CREATE INDEX IF NOT EXISTS idx_paper_trades_maker ON paper_trades(maker_order_id);
-- @statement
CREATE INDEX IF NOT EXISTS idx_paper_trades_taker ON paper_trades(taker_order_id);
-- @statement
DROP TRIGGER IF EXISTS paper_trades_append_only ON paper_trades;
-- @statement
CREATE TRIGGER paper_trades_append_only
BEFORE UPDATE OR DELETE ON paper_trades
FOR EACH ROW EXECUTE FUNCTION paper_reject_journal_rewrite();
