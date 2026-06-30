// System-prompt builder. The persona + rules + knowledge are assembled from
// the active config — this is what makes one engine serve many businesses.
// Built-in imports only (loads knowledge from disk), so it stays SDK-free.
import type { BusinessConfig, MenuItem } from "./types.ts";
import { loadMenu, loadListings } from "./config.ts";

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
- Respuestas cortas (WhatsApp), cálidas y profesionales.`;

function groupMenu(items: MenuItem[]): string {
  const available = items.filter((i) => i.disponible);
  const cats = [...new Set(available.map((i) => i.categoria))];
  const lines: string[] = [];
  for (const cat of cats) {
    lines.push(`# ${cat}`);
    for (const i of available.filter((x) => x.categoria === cat)) {
      const price = i.promo ? i.promo.precio_mxn : i.precio_mxn;
      const promo = i.promo ? `  (PROMO: ${i.promo.etiqueta_es})` : "";
      const mods = i.modificadores?.length
        ? `  [mods: ${i.modificadores.map((m) => (m.precio_mxn ? `${m.nombre_es} +$${m.precio_mxn}` : m.nombre_es)).join(", ")}]`
        : "";
      lines.push(`- ${i.id} · ${i.nombre_es} — $${price}${promo}${mods}`);
    }
  }
  return lines.join("\n");
}

function listingsSummary(config: BusinessConfig): string {
  const items = loadListings(config).filter((l) => l.disponible);
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

export function buildSystemPrompt(config: BusinessConfig): string {
  const parts: string[] = [];
  parts.push(config.persona_es.trim());
  parts.push(
    `Negocio: ${config.business_name}. Responde en español de México (es-MX), cálido y breve (es WhatsApp).`,
  );

  if (config.tool_pack === "restaurant") {
    parts.push("MENÚ DISPONIBLE (precios en MXN, IVA incluido):\n" + groupMenu(loadMenu(config).items));
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
    parts.push(listingsSummary(config));
    parts.push(REALESTATE_RULES);
  }

  return parts.join("\n\n");
}
