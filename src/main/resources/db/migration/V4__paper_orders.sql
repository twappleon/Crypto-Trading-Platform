-- Round 005. PAPER ONLY: order persistence and collateral are inserted in one transaction.
CREATE TABLE IF NOT EXISTS paper_limit_orders (
    id VARCHAR(80) PRIMARY KEY,
    account_id VARCHAR(96) NOT NULL,
    base_asset VARCHAR(12) NOT NULL,
    quote_asset VARCHAR(12) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    limit_price NUMERIC(38,18) NOT NULL CHECK (limit_price > 0),
    quantity NUMERIC(38,18) NOT NULL CHECK (quantity > 0),
    hold_id VARCHAR(96) NOT NULL UNIQUE REFERENCES paper_ledger_holds(id) ON DELETE RESTRICT,
    held_asset VARCHAR(12) NOT NULL,
    reserved_amount NUMERIC(38,18) NOT NULL CHECK (reserved_amount > 0),
    state VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    canceled_at TIMESTAMPTZ,
    CONSTRAINT paper_order_different_assets CHECK (base_asset <> quote_asset),
    CONSTRAINT paper_order_cancel_time CHECK (
        (state = 'OPEN' AND canceled_at IS NULL)
        OR (state = 'CANCELED' AND canceled_at IS NOT NULL)
    ),
    CONSTRAINT paper_order_held_asset CHECK (
        (side='BUY' AND held_asset=quote_asset)
        OR (side='SELL' AND held_asset=base_asset)
    ),
    CONSTRAINT paper_order_reserved_amount CHECK (
        (side='BUY' AND reserved_amount=limit_price*quantity)
        OR (side='SELL' AND reserved_amount=quantity)
    ),
    CONSTRAINT paper_order_collateral_account_fk FOREIGN KEY (held_asset, account_id)
        REFERENCES paper_ledger_accounts(asset, account_id) ON DELETE RESTRICT
);
-- @statement
CREATE INDEX IF NOT EXISTS idx_paper_orders_owner_state
    ON paper_limit_orders(account_id, state);
