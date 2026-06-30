-- 001_init.sql — Asistente de Pedidos schema. Idempotent; safe to re-run.
-- Applied automatically on boot by src/db.ts (migrate), or manually: npm run migrate

-- Conversation sessions (durable across restarts/replicas).
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,                          -- channel user id, e.g. whatsapp:+52...
  business_slug TEXT NOT NULL,
  profile_name  TEXT,
  state         JSONB NOT NULL DEFAULT '{}'::jsonb,        -- messages, order, reservations, ticketSeq
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Structured kitchen/POS tickets emitted by emit_ticket.
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id  TEXT PRIMARY KEY,
  business   TEXT NOT NULL,
  channel    TEXT,
  total      NUMERIC,
  currency   TEXT,
  payload    JSONB NOT NULL,                               -- full KitchenTicket JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic business event log: reservation | viewing | lead | handoff | session_reset.
CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  business   TEXT,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_business   ON sessions (business_slug);
CREATE INDEX IF NOT EXISTS idx_tickets_created     ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events (type, created_at DESC);
