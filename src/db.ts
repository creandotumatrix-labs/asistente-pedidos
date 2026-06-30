// Postgres layer — the live data backbone.
//  • Catalog (menu_items, listings) is READ live on every agent turn.
//  • Tickets + events are WRITTEN as they happen.
// On Railway, DATABASE_URL points at the private Postgres (postgres.railway.internal,
// no SSL). migrate() runs on boot: applies schema + seed, with retry for the
// few-second private-network warmup. No JSON fallback at runtime by design.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { projectRoot } from "./config.ts";
import type { Menu, MenuItem, Listing } from "./types.ts";

const url = process.env.DATABASE_URL;
export const pool: pg.Pool | null = url
  ? new pg.Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 10_000, // fail loud instead of hanging forever
      idleTimeoutMillis: 30_000,
      keepAlive: true,
    })
  : null;
export const dbEnabled = !!pool;

const MIGRATIONS = ["001_init.sql", "002_seed.sql"];

/** Apply schema + seed. Idempotent. Retries to ride out Railway private-net warmup. */
export async function migrate(): Promise<void> {
  if (!pool) {
    console.log("[db] DATABASE_URL no configurada — sin catálogo. Configura Postgres para operar.");
    return;
  }
  const dir = join(projectRoot(), "migrations");
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      for (const f of MIGRATIONS) await pool.query(readFileSync(join(dir, f), "utf8"));
      const c = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM menu_items");
      const l = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM listings");
      console.log(`[db] migración + seed OK — ${c.rows[0].n} platillos, ${l.rows[0].n} propiedades en catálogo.`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`[db] migración intento ${attempt}/4 falló: ${e instanceof Error ? e.message : e}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

// ── LIVE catalog reads (used by the agent every turn) ───────────────
interface MenuRow {
  item_id: string;
  nombre_es: string;
  categoria: string;
  precio_mxn: string;
  descripcion_es: string | null;
  modificadores: MenuItem["modificadores"];
  alergenos: string[] | null;
  promo: MenuItem["promo"];
  disponible: boolean;
}
export async function getMenuItems(businessSlug: string): Promise<Menu> {
  if (!pool) throw new Error("DATABASE_URL requerida: el catálogo se sirve desde Postgres.");
  const { rows } = await pool.query<MenuRow>(
    `SELECT item_id, nombre_es, categoria, precio_mxn, descripcion_es, modificadores, alergenos, promo, disponible
       FROM menu_items WHERE business_slug = $1 ORDER BY sort_order, item_id`,
    [businessSlug],
  );
  const items: MenuItem[] = rows.map((r) => ({
    id: r.item_id,
    nombre_es: r.nombre_es,
    categoria: r.categoria,
    precio_mxn: Number(r.precio_mxn),
    descripcion_es: r.descripcion_es ?? undefined,
    modificadores: r.modificadores ?? [],
    alergenos: r.alergenos ?? [],
    promo: r.promo ?? null,
    disponible: r.disponible,
  }));
  const categorias = [...new Set(items.map((i) => i.categoria))];
  return { moneda: "MXN", categorias, items };
}

interface ListingRow {
  listing_id: string;
  titulo_es: string;
  operacion: Listing["operacion"];
  zona: string;
  recamaras: number;
  banos: number;
  m2: number;
  precio_mxn: string;
  amenidades: string[] | null;
  disponible: boolean;
}
export async function getListings(businessSlug: string): Promise<Listing[]> {
  if (!pool) throw new Error("DATABASE_URL requerida: el inventario se sirve desde Postgres.");
  const { rows } = await pool.query<ListingRow>(
    `SELECT listing_id, titulo_es, operacion, zona, recamaras, banos, m2, precio_mxn, amenidades, disponible
       FROM listings WHERE business_slug = $1 ORDER BY sort_order, listing_id`,
    [businessSlug],
  );
  return rows.map((r) => ({
    id: r.listing_id,
    titulo_es: r.titulo_es,
    operacion: r.operacion,
    zona: r.zona,
    recamaras: r.recamaras,
    banos: r.banos,
    m2: r.m2,
    precio_mxn: Number(r.precio_mxn),
    amenidades: r.amenidades ?? [],
    disponible: r.disponible,
  }));
}

/** Persist a structured kitchen ticket. Fire-and-forget; never blocks a reply. */
export async function saveTicket(t: Record<string, unknown>): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO tickets (ticket_id, business, channel, total, currency, payload)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (ticket_id) DO UPDATE SET payload = EXCLUDED.payload, total = EXCLUDED.total`,
      [t.ticket_id, t.business, t.channel ?? null, t.total ?? null, t.currency ?? null, JSON.stringify(t)],
    );
  } catch (e) {
    console.error("[db] saveTicket:", e instanceof Error ? e.message : e);
  }
}

/** Persist a business event (reservation/viewing/lead/handoff/etc.). */
export async function saveEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`INSERT INTO events (type, business, payload) VALUES ($1,$2,$3)`, [
      type,
      payload.business ?? null,
      JSON.stringify(payload),
    ]);
  } catch (e) {
    console.error("[db] saveEvent:", e instanceof Error ? e.message : e);
  }
}

/** Read-back for verification/observability: live counts + recent rows from Postgres. */
export async function stats(): Promise<Record<string, unknown>> {
  if (!pool) return { db: false, note: "DATABASE_URL no configurada (sin catálogo)" };
  const [tc, ec, mc, lc, rt, re] = await Promise.all([
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM tickets"),
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM events"),
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM menu_items"),
    pool.query<{ n: number }>("SELECT count(*)::int AS n FROM listings"),
    pool.query("SELECT ticket_id, business, total, currency, created_at FROM tickets ORDER BY created_at DESC LIMIT 5"),
    pool.query("SELECT type, business, created_at FROM events ORDER BY created_at DESC LIMIT 5"),
  ]);
  return {
    db: true,
    menu_items_total: mc.rows[0].n,
    listings_total: lc.rows[0].n,
    tickets_total: tc.rows[0].n,
    events_total: ec.rows[0].n,
    recent_tickets: rt.rows,
    recent_events: re.rows,
  };
}
