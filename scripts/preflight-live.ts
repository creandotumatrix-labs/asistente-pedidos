// Live-loop preflight — the single check that moves the system from "proven in
// theory" to "proven end-to-end". Runs ONE real turn through the real Claude
// tool-use loop (no WhatsApp needed) and confirms the agent replies and grounds
// itself in the menu via tools. Needs ANTHROPIC_API_KEY.
//   npm run preflight   [-- --business=inmobiliaria-cdmx]
import { newSession } from "../src/session.ts";

try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* env may be set another way */
}

const args = process.argv.slice(2);
const BUSINESS = args.find((a) => a.startsWith("--business="))?.split("=")[1] || process.env.BUSINESS || "taqueria-el-pastor";
const MODEL = process.env.MODEL || "claude-sonnet-4-6";

function die(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  die("ANTHROPIC_API_KEY no está configurada. Añádela como Codespaces secret o en .env, y reintenta.");
}

console.log(`\n\x1b[1mPreflight en vivo\x1b[0m — negocio=${BUSINESS} · modelo=${MODEL}\n`);

// dynamic import so the SDK only loads after the key check passes
const { runAgent } = await import("../src/agent.ts");

const probe =
  BUSINESS === "inmobiliaria-cdmx"
    ? "hola, busco depa en renta en la Condesa de 2 recámaras"
    : "hola, ¿qué tacos tienen y cuánto cuesta el de pastor?";

const events: Array<{ type: string }> = [];
const session = newSession("preflight", BUSINESS, "Preflight");

const t0 = Date.now();
let replies: string[];
try {
  replies = await runAgent(session, probe, (type) => events.push({ type }));
} catch (e) {
  die("La llamada al modelo falló: " + (e instanceof Error ? e.message : String(e)));
}
const ms = Date.now() - t0;

console.log(`\x1b[36mCliente:\x1b[0m ${probe}`);
for (const r of replies) console.log(`\x1b[32mAgente:\x1b[0m  ${r}`);

const toolCalls = session.messages.filter(
  (m) => m.role === "assistant" && Array.isArray(m.content) && (m.content as Array<{ type?: string }>).some((b) => b.type === "tool_use"),
).length;

console.log(`\n\x1b[2mlatencia ${ms} ms · turnos de herramienta: ${toolCalls} · eventos: ${events.length}\x1b[0m`);

const ok = replies.length > 0 && replies.join(" ").trim().length > 0;
if (!ok) die("El agente no produjo respuesta. Revisa modelo/clave/red.");
console.log(`\n\x1b[32m\x1b[1m✔ Loop en vivo PROBADO — SDK + modelo + tools + grounding funcionan.\x1b[0m`);
console.log(`\x1b[2m  Siguiente: expón el puerto 8080 y conecta WhatsApp (ver CODESPACES.md).\x1b[0m\n`);
