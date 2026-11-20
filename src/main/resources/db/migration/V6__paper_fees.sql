-- Round 007: PAPER maker/taker fee audit. Existing trade rows default to zero fee.
-- Additive migration for disposable integration environment; NOT a production release.
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS maker_fee_bps INTEGER NOT NULL DEFAULT 0;
-- @statement
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS taker_fee_bps INTEGER NOT NULL DEFAULT 0;
-- @statement
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS buyer_fee_base NUMERIC(38,18) NOT NULL DEFAULT 0;
-- @statement
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS seller_fee_quote NUMERIC(38,18) NOT NULL DEFAULT 0;
-- @statement
ALTER TABLE paper_trades DROP CONSTRAINT IF EXISTS paper_trade_fee_bounds;
-- @statement
ALTER TABLE paper_trades ADD CONSTRAINT paper_trade_fee_bounds CHECK (
    maker_fee_bps BETWEEN 0 AND 1000 AND taker_fee_bps BETWEEN 0 AND 1000
    AND buyer_fee_base >= 0 AND buyer_fee_base < quantity
    AND seller_fee_quote >= 0 AND seller_fee_quote < (execution_price * quantity)
);
