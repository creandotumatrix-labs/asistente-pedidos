// Generates migrations/002_seed.sql from the JSON fixtures in /data.
// The JSON is no longer read at runtime — it is only the source of this seed
// and of the deterministic test fixtures. Run: node --experimental-strip-types scripts/gen-seed.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const q = (s: unknown) => "'" + String(s).replace(/'/g, "''") + "'";
const jb = (v: unknown) => (v == null ? "NULL" : q(JSON.stringify(v)) + "::jsonb");
const bool = (b: unknown) => (b ? "true" : "false");

interface MenuFile {
  items: Array<{
    id: string;
    nombre_es: string;
    categoria: string;
    precio_mxn: number;
    descripcion_es?: string;
    modificadores?: unknown[];
    alergenos?: unknown[];
    promo?: unknown;
    disponible: boolean;
  }>;
}
interface ListingFile {
  id: string;
  titulo_es: string;
  operacion: string;
  zona: string;
  recamaras: number;
  banos: number;
  m2: number;
  precio_mxn: number;
  amenidades?: unknown[];
  disponible: boolean;
}

const MENUS: Array<[string, string]> = [
  ["taqueria-el-pastor", "data/menu.taqueria.json"],
  ["la-mesa-fina", "data/menu.finedining.json"],
];
const LISTINGS: Array<[string, string]> = [["inmobiliaria-cdmx", "data/listings.cdmx.json"]];

function menuValues(slug: string, file: string): string[] {
  const menu = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as MenuFile;
  return menu.items.map((it, i) =>
    `  (${q(slug)}, ${q(it.id)}, ${q(it.nombre_es)}, ${q(it.categoria)}, ${it.precio_mxn}, ` +
      `${it.descripcion_es ? q(it.descripcion_es) : "NULL"}, ${jb(it.modificadores ?? [])}, ` +
      `${jb(it.alergenos ?? [])}, ${it.promo ? jb(it.promo) : "NULL"}, ${bool(it.disponible)}, ${i})`,
  );
}
function listingValues(slug: string, file: string): string[] {
  const rows = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as ListingFile[];
  return rows.map((l, i) =>
    `  (${q(slug)}, ${q(l.id)}, ${q(l.titulo_es)}, ${q(l.operacion)}, ${q(l.zona)}, ${l.recamaras}, ` +
      `${l.banos}, ${l.m2}, ${l.precio_mxn}, ${jb(l.amenidades ?? [])}, ${bool(l.disponible)}, ${i})`,
  );
}

const menuRows = MENUS.flatMap(([s, f]) => menuValues(s, f));
const listingRows = LISTINGS.flatMap(([s, f]) => listingValues(s, f));

const sql = `-- 002_seed.sql — initial catalog (menu_items + listings), GENERATED from /data by scripts/gen-seed.ts.
-- Idempotent: ON CONFLICT DO NOTHING. After this seed, Postgres is the source of truth;
-- the running agent reads these tables live (no JSON at runtime).

INSERT INTO menu_items
  (business_slug, item_id, nombre_es, categoria, precio_mxn, descripcion_es, modificadores, alergenos, promo, disponible, sort_order)
VALUES
${menuRows.join(",\n")}
ON CONFLICT (business_slug, item_id) DO NOTHING;

INSERT INTO listings
  (business_slug, listing_id, titulo_es, operacion, zona, recamaras, banos, m2, precio_mxn, amenidades, disponible, sort_order)
VALUES
${listingRows.join(",\n")}
ON CONFLICT (business_slug, listing_id) DO NOTHING;
`;

writeFileSync(join(ROOT, "migrations", "002_seed.sql"), sql);
console.log(`✓ migrations/002_seed.sql — ${menuRows.length} menu rows, ${listingRows.length} listing rows`);
