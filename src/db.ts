// Postgres layer. Optional: if DATABASE_URL is unset, everything no-ops and the
// app runs in pure in-memory mode (so tests/local boot need no DB). On Railway,
// DATABASE_URL is injected from the Postgres service and migrate() runs on boot.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { projectRoot } from "./config.ts";

const url = process.env.DATABASE_URL;
export const pool: pg.Pool | null = url ? new pg.Pool({ connectionString: url, max: 5 }) : null;
export const dbEnabled = !!pool;

/** Apply the schema. Idempotent (CREATE TABLE IF NOT EXISTS). */
export async function migrate(): Promise<void> {
  if (!pool) {
    console.log("[db] DATABASE_URL no configurada — migración omitida (modo memoria).");
    return;
  }
  const sql = readFileSync(join(projectRoot(), "migrations", "001_init.sql"), "utf8");
  await pool.query(sql);
  console.log("[db] migración aplicada — tablas listas (sessions, tickets, events).");
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
