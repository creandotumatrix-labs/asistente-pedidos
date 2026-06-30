// Config + catalog loaders.
//  • loadConfig  — business config (persona/branding/services). File-based (deploy config).
//  • loadMenu / loadListings — LIVE catalog from Postgres. Real DB calls, no JSON
//    at runtime. The agent runtime calls these once per turn.
//  • readMenuFixture / readListingsFixture — sync file readers used ONLY by tests,
//    preflight, and the seed generator. Never on the live request path.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BusinessConfig, Menu, Listing } from "./types.ts";

const ROOT = join(import.meta.dirname, "..");

export function loadConfig(slug: string): BusinessConfig {
  const path = join(ROOT, "configs", `${slug}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as BusinessConfig;
}

// ── LIVE catalog (Postgres) ─────────────────────────────────────────
// db.ts is imported dynamically so config.ts (and everything that imports it,
// like the tool packs and tests) carries no static dependency on `pg`.
export async function loadMenu(config: BusinessConfig): Promise<Menu> {
  const { getMenuItems } = await import("./db.ts");
  return getMenuItems(config.slug);
}
export async function loadListings(config: BusinessConfig): Promise<Listing[]> {
  const { getListings } = await import("./db.ts");
  return getListings(config.slug);
}

// ── Fixtures (sync, file) — tests / preflight / seed generator only ──
const menuFixtureCache = new Map<string, Menu>();
export function readMenuFixture(config: BusinessConfig): Menu {
  const rel = config.knowledge.menu;
  if (!rel) throw new Error(`Config ${config.slug} has no menu knowledge file`);
  const cached = menuFixtureCache.get(rel);
  if (cached) return cached;
  const menu = JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Menu;
  menuFixtureCache.set(rel, menu);
  return menu;
}

const listingsFixtureCache = new Map<string, Listing[]>();
export function readListingsFixture(config: BusinessConfig): Listing[] {
  const rel = config.knowledge.listings;
  if (!rel) throw new Error(`Config ${config.slug} has no listings knowledge file`);
  const cached = listingsFixtureCache.get(rel);
  if (cached) return cached;
  const listings = JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Listing[];
  listingsFixtureCache.set(rel, listings);
  return listings;
}

export function projectRoot(): string {
  return ROOT;
}
