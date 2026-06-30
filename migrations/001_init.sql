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

-- LIVE catalog. The running agent reads these on every request (no JSON at runtime).
-- Seeded by 002_seed.sql; after that, Postgres is the source of truth (mutable live).
CREATE TABLE IF NOT EXISTS menu_items (
  business_slug  TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  nombre_es      TEXT NOT NULL,
  categoria      TEXT NOT NULL,
  precio_mxn     NUMERIC NOT NULL,
  descripcion_es TEXT,
  modificadores  JSONB NOT NULL DEFAULT '[]'::jsonb,
  alergenos      JSONB NOT NULL DEFAULT '[]'::jsonb,
  promo          JSONB,
  disponible     BOOLEAN NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_slug, item_id)
);

CREATE TABLE IF NOT EXISTS listings (
  business_slug TEXT NOT NULL,
  listing_id    TEXT NOT NULL,
  titulo_es     TEXT NOT NULL,
  operacion     TEXT NOT NULL,
  zona          TEXT NOT NULL,
  recamaras     INT NOT NULL,
  banos         INT NOT NULL,
  m2            INT NOT NULL,
  precio_mxn    NUMERIC NOT NULL,
  amenidades    JSONB NOT NULL DEFAULT '[]'::jsonb,
  disponible    BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_slug, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_business   ON sessions (business_slug);
CREATE INDEX IF NOT EXISTS idx_tickets_created     ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_business       ON menu_items (business_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_listings_business   ON listings (business_slug, sort_order);
