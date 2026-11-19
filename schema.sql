-- Run once in your hosted PostgreSQL SQL console.
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash CHAR(64) UNIQUE NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS token_events (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  kind TEXT NOT NULL CHECK (kind IN ('grant', 'usage')),
  token_delta BIGINT NOT NULL CHECK (
    (kind = 'grant' AND token_delta > 0) OR
    (kind = 'usage' AND token_delta <= 0)
  ),
  -- Usage events will be settled server-side from provider responses.
  request_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS token_events_customer ON token_events(customer_id, created_at);
CREATE TABLE IF NOT EXISTS admin_audit (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  action TEXT NOT NULL CHECK (action IN ('create','grant','revoke')),
  reason TEXT NOT NULL,
  token_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS token_reservations (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens > 0),
  actual_tokens BIGINT,
  status TEXT NOT NULL CHECK (status IN ('held','settled','review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_unsettled_request_per_customer
  ON token_reservations(customer_id) WHERE status IN ('held','review');
-- No expiration or monthly reset. Grants persist until consumed.
