// Deterministic tests — NO network, NO SDK. Proves tool-side math, 86'ing,
// promos, modifiers, the structured ticket contract, and config guardrails.
// Run: node --experimental-strip-types scripts/test.ts   (or: npm test)
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.ts";
import { newSession } from "../src/session.ts";
import { restaurantTools } from "../src/tools/restaurant.ts";
import { realEstateTools } from "../src/tools/realestate.ts";
import type { BusinessConfig, Session, ToolContext, ToolDef, ToolResult } from "../src/types.ts";

let pass = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log("  \x1b[32m✔\x1b[0m " + name);
  } catch (e) {
    fails.push(name);
    console.log("  \x1b[31m✗\x1b[0m " + name + "\n      " + (e instanceof Error ? e.message : String(e)));
  }
}

interface Harness {
  ctx: ToolContext;
  session: Session;
  events: Array<{ type: string; payload: Record<string, unknown> }>;
  call: (pack: ToolDef[], name: string, input: Record<string, unknown>) => ToolResult;
}
function harness(slug: string): Harness {
  const config: BusinessConfig = loadConfig(slug);
  const session = newSession("whatsapp:+5215555550000", slug, "Marcus");
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const ctx: ToolContext = {
    session,
    config,
    emit: (type, payload) => events.push({ type, payload }),
    now: () => new Date("2026-06-29T20:00:00.000Z"),
  };
  const call = (pack: ToolDef[], name: string, input: Record<string, unknown>): ToolResult => {
    const t = pack.find((x) => x.name === name);
    if (!t) throw new Error(`tool no encontrada: ${name}`);
    return t.handler(input, ctx);
  };
  return { ctx, session, events, call };
}

console.log("\n\x1b[1mAsistente de Pedidos — pruebas deterministas\x1b[0m\n");

// ─────────────────────────────────────────────────────────────────────────
console.log("Restaurante · totales del lado de la herramienta");

test("El pedido del PRD suma exactamente $170 (3 pastor + horchata + guac en promo)", () => {
  const h = harness("taqueria-el-pastor");
  const r1 = h.call(restaurantTools, "add_to_order", {
    items: [
      { item: "taco_pastor", qty: 3, mods: ["con todo"] },
      { item: "agua_horchata", qty: 1 },
    ],
  });
  assert.equal((r1.order as { total: number }).total, 125, "tras tacos + horchata debe ir 125");
  const r2 = h.call(restaurantTools, "add_to_order", { items: [{ item: "guacamole", qty: 1 }] });
  assert.equal((r2.order as { total: number }).total, 170, "con guac en promo debe ser 170");
});

test("Promo aplicada: guacamole se cobra a $45, no a $55", () => {
  const h = harness("taqueria-el-pastor");
  const r = h.call(restaurantTools, "add_to_order", { items: [{ item: "guacamole", qty: 1 }] });
  const line = (r.order as { lines: Array<{ unit_price: number }> }).lines[0];
  assert.equal(line.unit_price, 45);
});

test("Modificador con costo: pastor 'con queso' = $30 + $12 = $42", () => {
  const h = harness("taqueria-el-pastor");
  const r = h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_pastor", qty: 1, mods: ["con queso"] }] });
  const line = (r.order as { lines: Array<{ unit_price: number; line_total: number }> }).lines[0];
  assert.equal(line.unit_price, 42);
  assert.equal(line.line_total, 42);
});

test("Líneas idénticas se fusionan y recalculan la cantidad", () => {
  const h = harness("taqueria-el-pastor");
  h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_suadero", qty: 2, mods: ["con todo"] }] });
  const r = h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_suadero", qty: 1, mods: ["con todo"] }] });
  const lines = (r.order as { lines: Array<{ qty: number; line_total: number }> }).lines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].qty, 3);
  assert.equal(lines[0].line_total, 90);
});

// ─────────────────────────────────────────────────────────────────────────
console.log("\nRestaurante · grounding y 86'ing");

test("No vende artículos agotados (86): quesabirria es rechazada", () => {
  const h = harness("taqueria-el-pastor");
  const r = h.call(restaurantTools, "add_to_order", { items: [{ item: "quesabirria", qty: 1 }] });
  assert.equal(r.ok, false);
  const rech = r.rechazados as Array<{ motivo: string }>;
  assert.equal(rech[0].motivo, "agotado_86");
  assert.equal((r.order as { lines: unknown[] }).lines.length, 0);
});

test("No inventa platillos: un item inexistente es rechazado", () => {
  const h = harness("taqueria-el-pastor");
  const r = h.call(restaurantTools, "add_to_order", { items: [{ item: "sushi", qty: 1 }] });
  const rech = r.rechazados as Array<{ motivo: string }>;
  assert.equal(rech[0].motivo, "no_existe");
});

// ─────────────────────────────────────────────────────────────────────────
console.log("\nRestaurante · cierre de pedido y ticket estructurado");

test("create_order exige confirmar servicio y asigna folio con prefijo", () => {
  const h = harness("taqueria-el-pastor");
  h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_pastor", qty: 3, mods: ["con todo"] }, { item: "agua_horchata", qty: 1 }, { item: "guacamole", qty: 1 }] });
  const r = h.call(restaurantTools, "create_order", { type: "pickup", time: "14:00" });
  assert.equal(r.ok, true);
  assert.match(String(r.order_id), /^A-\d+$/);
  assert.equal(r.total, 170);
});

test("Delivery sin dirección es rechazado", () => {
  const h = harness("taqueria-el-pastor");
  h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_pastor", qty: 2 }] });
  const r = h.call(restaurantTools, "create_order", { type: "delivery" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "falta_direccion");
});

test("emit_ticket produce un ticket válido contra el esquema y emite al bus", () => {
  const h = harness("taqueria-el-pastor");
  h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_pastor", qty: 3, mods: ["con todo"] }, { item: "agua_horchata", qty: 1 }, { item: "guacamole", qty: 1 }] });
  h.call(restaurantTools, "create_order", { type: "pickup", time: "14:00", name: "Marcus" });
  const r = h.call(restaurantTools, "emit_ticket", {});
  assert.equal(r.ok, true);
  const ticket = r.ticket as Record<string, unknown>;
  validateTicket(ticket);
  assert.equal(ticket.total, 170);
  assert.equal((ticket.items as unknown[]).length, 3);
  // emitted on the bus for the kitchen board
  const emitted = h.events.find((e) => e.type === "ticket");
  assert.ok(emitted, "debió emitirse un evento 'ticket'");
});

test("Reservación de mesa emite evento y regresa folio", () => {
  const h = harness("taqueria-el-pastor");
  const r = h.call(restaurantTools, "book_table", { size: 4, datetime: "2026-07-01 21:00", name: "Ana", tel: "+525511112222" });
  assert.equal(r.ok, true);
  assert.match(String(r.reservation_id), /^R-\d+$/);
  assert.ok(h.events.find((e) => e.type === "reservation"));
});

// ─────────────────────────────────────────────────────────────────────────
console.log("\nWhite-label · misma runtime, otro negocio (bienes raíces)");

test("get_listings filtra por operación y zona, solo disponibles", () => {
  const h = harness("inmobiliaria-cdmx");
  const r = h.call(realEstateTools, "get_listings", { operacion: "renta", zona: "Polanco" });
  const ls = r.listings as Array<{ id: string; disponible?: boolean }>;
  assert.ok(ls.length >= 1);
  assert.ok(ls.every((l) => l.id.startsWith("RN-")));
  assert.ok(ls.find((l) => l.id === "RN-03"));
});

test("schedule_viewing valida la propiedad y emite evento 'viewing'", () => {
  const h = harness("inmobiliaria-cdmx");
  const r = h.call(realEstateTools, "schedule_viewing", { listing_id: "VN-01", datetime: "2026-07-02 17:00", name: "Luis", tel: "+525500001111" });
  assert.equal(r.ok, true);
  assert.ok(h.events.find((e) => e.type === "viewing"));
});

test("qualify_lead califica nivel por presupuesto", () => {
  const h = harness("inmobiliaria-cdmx");
  const r = h.call(realEstateTools, "qualify_lead", { name: "Luis", operacion: "venta", presupuesto_max: 18000000, zona: "Polanco" });
  assert.equal(r.tier, "alto");
});

// ─────────────────────────────────────────────────────────────────────────
console.log("\nWhite-label · persona y reglas de servicio por config");

test("La Mesa Fina no ofrece delivery (servicio deshabilitado por config)", () => {
  const h = harness("la-mesa-fina");
  h.call(restaurantTools, "add_to_order", { items: [{ item: "rib_eye", qty: 1, mods: ["término medio"] }] });
  const r = h.call(restaurantTools, "create_order", { type: "delivery", address: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "servicio_no_disponible");
});

test("Determinismo: el mismo pedido produce el mismo total en dos corridas", () => {
  const run = () => {
    const h = harness("taqueria-el-pastor");
    h.call(restaurantTools, "add_to_order", { items: [{ item: "taco_bistec", qty: 2, mods: ["con queso"] }, { item: "refresco", qty: 2 }] });
    return (h.session.order.total);
  };
  assert.equal(run(), run());
  assert.equal(run(), 2 * (34 + 12) + 2 * 30); // 92 + 60 = 152
});

// ── minimal ticket-schema validator (no ajv needed) ──
function validateTicket(t: Record<string, unknown>): void {
  const schema = JSON.parse(readFileSync(join(import.meta.dirname, "..", "schemas", "ticket.schema.json"), "utf8"));
  for (const key of schema.required as string[]) {
    assert.ok(key in t, `ticket sin campo requerido: ${key}`);
  }
  assert.ok(["pickup", "delivery", "dine_in"].includes((t.service as { type: string }).type), "service.type inválido");
  assert.equal((t as { status: string }).status, "new");
  const items = t.items as Array<Record<string, unknown>>;
  assert.ok(items.length >= 1, "ticket sin items");
  for (const it of items) {
    for (const k of ["id", "name", "qty", "unit_price", "line_total"]) assert.ok(k in it, `item sin ${k}`);
    assert.equal(it.line_total, (it.unit_price as number) * (it.qty as number), "line_total inconsistente");
  }
  const sum = items.reduce((s, it) => s + (it.line_total as number), 0);
  assert.equal(t.subtotal, sum, "subtotal != suma de líneas");
  assert.equal(t.total, sum, "total != suma de líneas");
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1mResultado:\x1b[0m ${pass} pruebas OK, ${fails.length} fallidas\n`);
if (fails.length) {
  process.exit(1);
}
