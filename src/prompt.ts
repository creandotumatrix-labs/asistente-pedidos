// System-prompt builder. The persona + rules + knowledge are assembled from
// the active config + the LIVE catalog passed in by the agent runtime (fetched
// from Postgres). Built-in imports only — no SDK, no DB, no file reads here.
import type { BusinessConfig, MenuItem, Menu, Listing } from "./types.ts";

const RESTAURANT_RULES = `Reglas (cúmplelas siempre):
- Vende SOLO platillos del menú DISPONIBLE, a los precios indicados. Nunca inventes platillos, precios ni promociones.
- Registra artículos con add_to_order y cierra con create_order. El ÚNICO total válido es el que regresan las herramientas; NUNCA sumes ni calcules totales tú.
- Confirma artículos + total con el cliente ANTES de create_order. Inmediatamente DESPUÉS de create_order llama a emit_ticket. Al cerrar da solo un remate BREVE y cálido (ej.: «¡Sale, ya quedó! 🌮»); el sistema añade el folio y el total automáticamente, así que NO los repitas tú.
- Ofrece como máximo UN upsell relevante, sin insistir.
- Alergias / temas médicos: responde solo con datos del menú; si es serio o no estás seguro, usa handoff_human. No des consejo médico.
- Fuera de horario: toma el pedido programado u ofrece el siguiente horario disponible.
- Formato WhatsApp: para negritas usa *un solo asterisco* (NUNCA dobles **). Respuestas cortas, máx ~4 líneas, emojis con moderación.`;

const REALESTATE_RULES = `Reglas (cúmplelas siempre):
- Muestra SOLO propiedades reales del inventario (usa get_listings). Nunca inventes propiedades ni precios.
- Califica al prospecto con qualify_lead cuando tengas operación + presupuesto o zona.
- Agenda visitas con schedule_viewing tras confirmar fecha/hora, nombre y teléfono.
- Negociación o temas fuera de alcance: usa handoff_human.
- Formato WhatsApp: para negritas usa *un solo asterisco* (NUNCA dobles **). Respuestas cortas (máx ~5 líneas), cálidas y profesionales.`;

// Every date/time the model hands to a tool (book_table, schedule_viewing) is a
// free-text string it composes itself — nothing downstream re-derives it from a
// clock. Without a real "today" anchor here, the model has to guess the current
// date and reliably guesses wrong (wrong year, wrong day) when resolving
// relative expressions like "mañana" or "el viernes". This is the single place
// that grounding needs to live so every tool pack gets it for free.
const AGENDA_TZ = "America/Mexico_City";
function formatNow(now: Date): string {
const fecha = now.toLocaleDateString("es-MX", {
timeZone: AGENDA_TZ,
weekday: "long",
year: "numeric",
month: "long",
day: "numeric",
});
const hora = now.toLocaleTimeString("es-MX", {
timeZone: AGENDA_TZ,
hour: "2-digit",
minute: "2-digit",
});
return [
`Fecha y hora actuales: ${fecha}, ${hora} (hora de Ciudad de México).`,
`Usa esta fecha real para resolver "hoy", "mañana", "el viernes", etc. — nunca asumas ni inventes otro año o fecha.`,
`Al llamar herramientas que piden fecha/hora (datetime), usa el formato AAAA-MM-DD HH:MM en 24h, calculado a partir de la fecha real de arriba.`,
].join(" ");
}

function groupMenu(items: MenuItem[]): string {
const available = items.filter((i) => i.disponible);
const cats = [...new Set(available.map((i) => i.categoria))];
const lines: string[] = [];
for (const cat of cats) {
lines.push(`# ${cat}`);
for (const i of available.filter((x) => x.categoria === cat)) {
const price = i.promo ? i.promo.precio_mxn : i.precio_mxn;
const promo = i.promo ? ` (PROMO: ${i.promo.etiqueta_es})` : "";
const mods = i.modificadores?.length
? ` [mods: ${i.modificadores.map((m) => (m.precio_mxn ? `${m.nombre_es} +$${m.precio_mxn}` : m.nombre_es)).join(", ")}]`
: "";
lines.push(`- ${i.id} · ${i.nombre_es} — $${price}${promo}${mods}`);
}
}
return lines.join("\n");
}

function listingsSummary(all: Listing[]): string {
const items = all.filter((l) => l.disponible);
const zonas = [...new Set(items.map((l) => l.zona))];
const renta = items.filter((l) => l.operacion === "renta");
const venta = items.filter((l) => l.operacion === "venta");
const range = (arr: number[]) =>
arr.length ? `$${Math.min(...arr).toLocaleString("es-MX")}–$${Math.max(...arr).toLocaleString("es-MX")}` : "—";
return [
`Inventario: ${items.length} propiedades disponibles en ${zonas.join(", ")}.`,
`Renta: ${renta.length} (${range(renta.map((l) => l.precio_mxn))} MXN/mes).`,
`Venta: ${venta.length} (${range(venta.map((l) => l.precio_mxn))} MXN).`,
`Usa get_listings para filtrar y obtener IDs y detalles exactos.`,
].join("\n");
}

export function buildSystemPrompt(
config: BusinessConfig,
catalog: { menu?: Menu; listings?: Listing[] } = {},
now: Date = new Date(),
): string {
const parts: string[] = [];
parts.push(config.persona_es.trim());
parts.push(
`Negocio: ${config.business_name}. Responde en español de México (es-MX), cálido y breve (es WhatsApp).`,
);
parts.push(formatNow(now));

if (config.tool_pack === "restaurant") {
parts.push("MENÚ DISPONIBLE (precios en MXN, IVA incluido):\n" + groupMenu(catalog.menu?.items ?? []));
if (config.services?.length) {
const map: Record<string, string> = { pickup: "para llevar", delivery: "entrega", dine_in: "en sitio" };
parts.push(`Servicios: ${config.services.map((s) => map[s] ?? s).join(", ")}.`);
}
if (config.hours) parts.push(`Horario: ${config.hours.open}–${config.hours.close} (${config.hours.days_es ?? ""}).`);
if (config.upsell?.enabled && config.upsell.rules_es.length) {
parts.push("Upsell (ofrece UNO, relevante, sin insistir):\n- " + config.upsell.rules_es.join("\n- "));
}
parts.push(RESTAURANT_RULES);
} else {
parts.push(listingsSummary(catalog.listings ?? []));
parts.push(REALESTATE_RULES);
}

return parts.join("\n\n");
}
