// Config + knowledge loader. The white-label surface lives in /configs and /data.
// Built-in imports only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BusinessConfig, Menu, Listing } from "./types.ts";

const ROOT = join(import.meta.dirname, "..");

export function loadConfig(slug: string): BusinessConfig {
  const path = join(ROOT, "configs", `${slug}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as BusinessConfig;
}

const menuCache = new Map<string, Menu>();
export function loadMenu(config: BusinessConfig): Menu {
  const rel = config.knowledge.menu;
  if (!rel) throw new Error(`Config ${config.slug} has no menu knowledge file`);
  const cached = menuCache.get(rel);
  if (cached) return cached;
  const menu = JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Menu;
  menuCache.set(rel, menu);
  return menu;
}

const listingsCache = new Map<string, Listing[]>();
export function loadListings(config: BusinessConfig): Listing[] {
  const rel = config.knowledge.listings;
  if (!rel) throw new Error(`Config ${config.slug} has no listings knowledge file`);
  const cached = listingsCache.get(rel);
  if (cached) return cached;
  const listings = JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as Listing[];
  listingsCache.set(rel, listings);
  return listings;
}

export function projectRoot(): string {
  return ROOT;
}
