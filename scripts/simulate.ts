// Simulator — talk to the agent without WhatsApp.
//   Live REPL (real Claude):   npm run simulate            (needs ANTHROPIC_API_KEY)
//   Offline scripted demo:     npm run demo                (zero network, real tools)
// The scripted demo invokes the REAL tool pack, so totals are truly computed and a
// real structured ticket is emitted — your bulletproof fallback if the wifi dies.
import readline from "node:readline";
import { loadConfig } from "../src/config.ts";
import { newSession } from "../src/session.ts";
import { restaurantTools } from "../src/tools/restaurant.ts";
import type { ToolContext, ToolDef } from "../src/types.ts";

try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* no .env */
}

const args = process.argv.slice(2);
const scripted = args.some((a) => ["--script", "--mock", "--demo"].includes(a));
const BUSINESS = (args.find((a) => a.startsWith("--business="))?.split("=")[1]) || process.env.BUSINESS || "taqueria-el-pastor";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function feedPrinter(type: string, payload: Record<string, unknown>) {
  if (type === "ticket") {
    console.log(C.yellow("\n  ┌─ 🎫 TICKET → COCINA ──────────────────────────"));
    for (const line of JSON.stringify(payload, null, 2).split("\n")) console.log(C.yellow("  │ ") + line);
    console.log(C.yellow("  └────────────────────────────────────────────────\n"));
  } else {
    console.log(C.dim(`  · evento[${type}] ${JSON.stringify(payload)}`));
  }
}

function makeCtx(slug: string): ToolContext {
  const config = loadConfig(slug);
  const session = newSession("whatsapp:+5215555550000", slug, "Demo");
  return { session, config, emit: feedPrinter, now: () => new Date() };
}
function call(pack: ToolDef[], name: string, input: Record<string, unknown>, ctx: ToolContext) {
  return pack.find((t) => t.name === name)!.handler(input, ctx);
}

// ─── offline scripted demo: the canonical taquería flow, real tools ───────
async function runScript() {
  const ctx = makeCtx("taqueria-el-pastor");
  const cliente = (s: string) => console.log("\n" + C.cyan("Cliente:  ") + s);
  const agente = (s: string) => console.log(C.green("Agente:   ") + s);

  console.log(C.bold(`\n🌮  Demo determinista — ${ctx.config.business_name}  (sin red, tools reales)\n`));
  await sleep(300);

  cliente("buenas, quiero pedir para llevar");
  await sleep(400);
  agente("¡Claro! 🌮 ¿Qué se te antoja? Te paso el menú o me dices directo.");
  await sleep(500);

  cliente("3 tacos de pastor y un agua de horchata");
  call(restaurantTools, "add_to_order", { items: [{ item: "taco_pastor", qty: 3, mods: ["con todo"] }, { item: "agua_horchata", qty: 1 }] }, ctx);
  await sleep(400);
  agente("Van 3 de pastor 🌮 y una horchata. ¿Con todo (cebolla, cilantro, piña)?");
  await sleep(500);

  cliente("sí, con todo");
  await sleep(300);
  agente(C.dim("[upsell] ") + "Perfecto. ¿Le sumas una orden de guacamole? Va perfecto y está en promo a $45.");
  await sleep(500);

  cliente("va");
  call(restaurantTools, "add_to_order", { items: [{ item: "guacamole", qty: 1 }] }, ctx);
  await sleep(400);
  const o = ctx.session.order;
  agente("¡Sale! Tu pedido:");
  for (const l of o.lines) console.log(`          • ${l.qty} ${l.nombre_es}${l.mods.length ? " (" + l.mods.join(", ") + ")" : ""} — $${l.line_total}`);
  console.log("          " + C.bold(`Total: $${o.total} MXN`) + "  ¿Para llevar o entrega? ¿A qué hora?");
  await sleep(600);

  cliente("para llevar, 2pm");
  const created = call(restaurantTools, "create_order", { type: "pickup", time: "14:00", name: "Marcus" }, ctx);
  await sleep(400);
  agente(`Listo ✅ Pedido ${created.order_id} para recoger a las 2:00 pm. Te avisamos cuando esté.`);
  call(restaurantTools, "emit_ticket", {}, ctx);
  await sleep(200);

  const ok = o.total === 170;
  console.log((ok ? C.green("✔") : "\x1b[31m✗\x1b[0m") + ` total verificado del lado de la herramienta: $${o.total} ${ok ? "(correcto)" : "(ERROR)"}\n`);
  process.exit(ok ? 0 : 1);
}

// ─── live REPL against the real model ─────────────────────────────────────
async function runRepl() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(C.yellow("\n⚠  No hay ANTHROPIC_API_KEY. Usa el demo offline:  npm run demo\n"));
    process.exit(1);
  }
  const { runAgent } = await import("../src/agent.ts");
  const config = loadConfig(BUSINESS);
  const session = newSession("whatsapp:+5215555550000", BUSINESS, "Demo");

  console.log(C.bold(`\n💬  REPL en vivo — ${config.business_name}  (${BUSINESS} · ${config.tool_pack})`));
  console.log(C.dim("    comandos: /reset  /order  /exit\n"));
  console.log(C.green("Agente:   ") + (config.greeting_es ?? "¡Hola!"));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: C.cyan("\nCliente:  ") });
  rl.prompt();
  rl.on("line", async (raw) => {
    const line = raw.trim();
    if (line === "/exit") return rl.close();
    if (line === "/order") {
      console.log(C.dim("  " + JSON.stringify(session.order)));
      return rl.prompt();
    }
    if (line === "/reset") {
      session.messages = [];
      session.order = { lines: [], subtotal: 0, total: 0, status: "building" };
      console.log(C.dim("  (sesión reiniciada)"));
      return rl.prompt();
    }
    if (!line) return rl.prompt();
    try {
      const replies = await runAgent(session, line, feedPrinter);
      for (const r of replies) console.log(C.green("Agente:   ") + r);
    } catch (e) {
      console.log(C.yellow("  error: " + (e instanceof Error ? e.message : String(e))));
    }
    rl.prompt();
  });
  rl.on("close", () => {
    console.log(C.dim("\n¡Hasta luego! 🌮"));
    process.exit(0);
  });
}

if (scripted) void runScript();
else void runRepl();
