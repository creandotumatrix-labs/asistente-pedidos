// Real-estate tool pack — the white-label flip. Same ToolDef contract,
// same runtime, same WhatsApp number. Only the config + this pack differ.
import type { Listing, ToolContext, ToolDef, ToolResult } from "../types.ts";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mxn(n: number): string {
  return n.toLocaleString("es-MX");
}

const get_listings: ToolDef = {
  name: "get_listings",
  description:
    "Busca propiedades DISPONIBLES. Filtra por operación (renta/venta), zona, recámaras y presupuesto máximo. Solo muestra propiedades reales del inventario.",
  input_schema: {
    type: "object",
    properties: {
      operacion: { type: "string", enum: ["renta", "venta"] },
      zona: { type: "string" },
      recamaras: { type: "integer", minimum: 0 },
      presupuesto_max: { type: "integer", description: "Tope en MXN." },
    },
  },
  handler: (input, ctx): ToolResult => {
    let items = (ctx.listings ?? []).filter((l) => l.disponible);
    if (typeof input.operacion === "string") {
      items = items.filter((l) => l.operacion === input.operacion);
    }
    if (typeof input.zona === "string") {
      const z = norm(input.zona);
      items = items.filter((l) => norm(l.zona).includes(z));
    }
    if (typeof input.recamaras === "number") {
      items = items.filter((l) => l.recamaras >= (input.recamaras as number));
    }
    if (typeof input.presupuesto_max === "number") {
      items = items.filter((l) => l.precio_mxn <= (input.presupuesto_max as number));
    }
    return {
      ok: true,
      encontradas: items.length,
      listings: items.slice(0, 6).map((l: Listing) => ({
        id: l.id,
        titulo_es: l.titulo_es,
        operacion: l.operacion,
        zona: l.zona,
        recamaras: l.recamaras,
        banos: l.banos,
        m2: l.m2,
        precio_mxn: l.precio_mxn,
        precio_formato: `$${mxn(l.precio_mxn)} MXN${l.operacion === "renta" ? "/mes" : ""}`,
        amenidades: l.amenidades ?? [],
      })),
    };
  },
};

const schedule_viewing: ToolDef = {
  name: "schedule_viewing",
  description: "Agenda una visita a una propiedad. Confirma propiedad, fecha/hora, nombre y teléfono.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string" },
      datetime: { type: "string", description: "Fecha y hora, p.ej. '2026-07-02 17:00'." },
      name: { type: "string" },
      tel: { type: "string" },
    },
    required: ["listing_id", "datetime", "name", "tel"],
  },
  handler: (input, ctx): ToolResult => {
    const listing = (ctx.listings ?? []).find((l) => norm(l.id) === norm(String(input.listing_id ?? "")));
    if (!listing) return { ok: false, error: "propiedad_no_encontrada" };
    const viewing = {
      id: `V-${100 + ctx.session.reservations.length + 1}`,
      listing_id: listing.id,
      titulo_es: listing.titulo_es,
      zona: listing.zona,
      datetime: String(input.datetime ?? ""),
      name: String(input.name ?? ctx.session.profileName ?? ""),
      tel: String(input.tel ?? ctx.session.id.replace(/^whatsapp:/, "")),
    };
    // reuse the reservations array as the session's "appointments" bucket
    ctx.session.reservations.push({
      id: viewing.id,
      size: 1,
      datetime: viewing.datetime,
      name: viewing.name,
      tel: viewing.tel,
    });
    ctx.emit("viewing", { ...viewing, business: ctx.config.business_name });
    return { ok: true, viewing_id: viewing.id, ...viewing };
  },
};

const qualify_lead: ToolDef = {
  name: "qualify_lead",
  description:
    "Registra y califica a un prospecto (operación, presupuesto, zona, plazo de mudanza). Úsalo cuando tengas suficiente contexto del cliente.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      tel: { type: "string" },
      operacion: { type: "string", enum: ["renta", "venta"] },
      presupuesto_max: { type: "integer" },
      zona: { type: "string" },
      plazo_es: { type: "string", description: "Cuándo busca mudarse, p.ej. 'este mes'." },
    },
    required: ["name", "operacion"],
  },
  handler: (input, ctx): ToolResult => {
    const presupuesto = Number(input.presupuesto_max ?? 0);
    const tier = presupuesto >= 8_000_000 || presupuesto >= 40_000 ? "alto" : presupuesto > 0 ? "medio" : "por_definir";
    const lead = {
      id: `L-${100 + ctx.session.reservations.length + 1}`,
      name: String(input.name ?? ctx.session.profileName ?? ""),
      tel: String(input.tel ?? ctx.session.id.replace(/^whatsapp:/, "")),
      operacion: String(input.operacion ?? ""),
      presupuesto_max: presupuesto || null,
      zona: typeof input.zona === "string" ? input.zona : null,
      plazo_es: typeof input.plazo_es === "string" ? input.plazo_es : null,
      tier,
    };
    ctx.emit("lead", { ...lead, business: ctx.config.business_name });
    return { ok: true, lead_id: lead.id, tier, ...lead };
  },
};

const handoff_human: ToolDef = {
  name: "handoff_human",
  description: "Transfiere a un asesor humano (negociación, casos fuera de alcance). Incluye motivo y resumen.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" }, summary: { type: "string" } },
    required: ["reason", "summary"],
  },
  handler: (input, ctx): ToolResult => {
    ctx.emit("handoff", {
      reason: String(input.reason ?? ""),
      summary: String(input.summary ?? ""),
      session: ctx.session.id,
      business: ctx.config.business_name,
    });
    return { ok: true, handed_off: true, message: "Un asesor te contactará en breve. 🙌" };
  },
};

export const realEstateTools: ToolDef[] = [get_listings, schedule_viewing, qualify_lead, handoff_human];
