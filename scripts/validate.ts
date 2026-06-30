// Preflight validator — run before a demo to catch a bad config/menu fast.
//   node --experimental-strip-types scripts/validate.ts   (or: npm run validate)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, loadMenu, loadListings, projectRoot } from "../src/config.ts";
import { newSession } from "../src/session.ts";
import { restaurantTools } from "../src/tools/restaurant.ts";
import type { BusinessConfig, ToolContext } from "../src/types.ts";

const ROOT = projectRoot();
const problems: string[] = [];
const ok = (s: string) => console.log("  \x1b[32m✔\x1b[0m " + s);
const bad = (s: string) => {
  problems.push(s);
  console.log("  \x1b[31m✗\x1b[0m " + s);
};

console.log("\n\x1b[1mPreflight — Asistente de Pedidos\x1b[0m\n");

// 1) ticket schema parses
try {
  JSON.parse(readFileSync(join(ROOT, "schemas", "ticket.schema.json"), "utf8"));
  ok("schemas/ticket.schema.json parsea");
} catch (e) {
  bad("ticket.schema.json no parsea: " + (e instanceof Error ? e.message : String(e)));
}

// 2) every config
const configFiles = readdirSync(join(ROOT, "configs")).filter((f) => f.endsWith(".json"));
console.log(`\nConfigs encontradas: ${configFiles.length}`);
for (const file of configFiles) {
  const slug = file.replace(/\.json$/, "");
  let cfg: BusinessConfig;
  try {
    cfg = loadConfig(slug);
  } catch (e) {
    bad(`${slug}: no carga (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  if (!cfg.persona_es) bad(`${slug}: falta persona_es`);
  if (!cfg.ticket_prefix) bad(`${slug}: falta ticket_prefix`);

  if (cfg.tool_pack === "restaurant") {
    if (!cfg.knowledge.menu || !existsSync(join(ROOT, cfg.knowledge.menu))) {
      bad(`${slug}: menú no encontrado (${cfg.knowledge.menu})`);
      continue;
    }
    const menu = loadMenu(cfg);
    const bad_prices = menu.items.filter((i) => !(i.precio_mxn > 0));
    const off = menu.items.filter((i) => !i.disponible).length;
    if (bad_prices.length) bad(`${slug}: ${bad_prices.length} item(s) con precio inválido`);
    else ok(`${slug} · restaurant · ${menu.items.length} platillos (${off} en 86) · "${cfg.business_name}"`);
  } else if (cfg.tool_pack === "realestate") {
    if (!cfg.knowledge.listings || !existsSync(join(ROOT, cfg.knowledge.listings))) {
      bad(`${slug}: inventario no encontrado (${cfg.knowledge.listings})`);
      continue;
    }
    const listings = loadListings(cfg);
    const bad_prices = listings.filter((l) => !(l.precio_mxn > 0));
    if (bad_prices.length) bad(`${slug}: ${bad_prices.length} propiedad(es) con precio inválido`);
    else ok(`${slug} · realestate · ${listings.length} propiedades · "${cfg.business_name}"`);
  } else {
    bad(`${slug}: tool_pack desconocido (${cfg.tool_pack})`);
  }
}

// 3) the PRD math, through the real tools
console.log("\nMatemática del PRD (3 pastor + horchata + guac promo):");
try {
  const cfg = loadConfig("taqueria-el-pastor");
  const session = newSession("whatsapp:+520000000000", "taqueria-el-pastor");
  const ctx: ToolContext = { session, config: cfg, emit: () => {}, now: () => new Date() };
  const add = restaurantTools.find((t) => t.name === "add_to_order")!;
  add.handler({ items: [{ item: "taco_pastor", qty: 3, mods: ["con todo"] }, { item: "agua_horchata", qty: 1 }, { item: "guacamole", qty: 1 }] }, ctx);
  if (session.order.total === 170) ok(`total = $170 ✓`);
  else bad(`total = $${session.order.total} (esperado 170)`);
} catch (e) {
  bad("fallo al calcular: " + (e instanceof Error ? e.message : String(e)));
}

console.log("");
if (problems.length) {
  console.log(`\x1b[31m\x1b[1m${problems.length} problema(s). Revisa antes del demo.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log(`\x1b[32m\x1b[1mTodo listo para el demo. 🚀\x1b[0m\n`);
}
