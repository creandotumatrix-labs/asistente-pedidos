// Restaurant tool pack. ALL money math is done here, deterministically —
// the model never computes a total. Built-in imports only (no SDK).
import type {
  MenuItem,
  OrderLine,
  ServiceType,
  ToolContext,
  ToolDef,
  ToolResult,
  KitchenTicket,
} from "../types.ts";

// ── helpers ────────────────────────────────────────────────────────
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findItem(menu: MenuItem[], ref: string): MenuItem | undefined {
  const r = norm(ref);
  // exact id, then exact name, then contains
  return (
    menu.find((m) => norm(m.id) === r) ||
    menu.find((m) => norm(m.nombre_es) === r) ||
    menu.find((m) => norm(m.nombre_es).includes(r) || r.includes(norm(m.id)))
  );
}

function unitPrice(item: MenuItem): number {
  return item.promo ? item.promo.precio_mxn : item.precio_mxn;
}

// Resolve free vs paid modifiers; returns display names + price delta.
function resolveMods(item: MenuItem, mods: string[]): { names: string[]; delta: number } {
  let delta = 0;
  const names: string[] = [];
  for (const raw of mods) {
    const m = norm(raw);
    const hit = (item.modificadores || []).find(
      (mod) => norm(mod.id) === m || norm(mod.nombre_es) === m || norm(mod.nombre_es).includes(m),
    );
    if (hit) {
      names.push(hit.nombre_es);
      if (hit.precio_mxn) delta += hit.precio_mxn;
    } else {
      names.push(raw); // free-text kitchen note (e.g. "sin cebolla")
    }
  }
  return { names, delta };
}

function recompute(lines: OrderLine[]): { subtotal: number; total: number } {
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  return { subtotal, total: subtotal }; // precios con IVA incluido
}

function summarize(ctx: ToolContext) {
  const { order } = ctx.session;
  return {
    lines: order.lines.map((l) => ({
      nombre_es: l.nombre_es,
      qty: l.qty,
      mods: l.mods,
      unit_price: l.unit_price,
      line_total: l.line_total,
    })),
    subtotal: order.subtotal,
    total: order.total,
    currency: ctx.config.currency,
  };
}

// ── tools ──────────────────────────────────────────────────────────
const get_menu: ToolDef = {
  name: "get_menu",
  description:
    "Devuelve los platillos DISPONIBLES del menú (con precios y promos). Úsalo para responder qué hay, precios o detalles. Filtra por categoría o búsqueda si se indica.",
  input_schema: {
    type: "object",
    properties: {
      categoria: { type: "string", description: "Categoría opcional, p.ej. 'tacos', 'bebidas'." },
      q: { type: "string", description: "Texto de búsqueda opcional." },
    },
  },
  handler: (input, ctx): ToolResult => {
    const menu = ctx.menu;
    if (!menu) return { ok: false, error: "catalogo_no_disponible" };
    let items = menu.items.filter((i) => i.disponible);
    if (typeof input.categoria === "string") {
      const c = norm(input.categoria);
      items = items.filter((i) => norm(i.categoria).includes(c));
    }
    if (typeof input.q === "string") {
      const q = norm(input.q);
      items = items.filter((i) => norm(i.nombre_es).includes(q) || norm(i.categoria).includes(q));
    }
    return {
      ok: true,
      moneda: menu.moneda,
      items: items.map((i) => ({
        id: i.id,
        nombre_es: i.nombre_es,
        categoria: i.categoria,
        precio_mxn: unitPrice(i),
        promo: i.promo ? i.promo.etiqueta_es : undefined,
        modificadores: (i.modificadores || []).map((m) => m.nombre_es),
      })),
    };
  },
};

const add_to_order: ToolDef = {
  name: "add_to_order",
  description:
    "Agrega artículos al pedido actual. Resuelve precios e impuestos del lado de la herramienta; NO calcules totales tú. Si un artículo no existe o no está disponible, lo regresa en 'rechazados' para que aclares.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string", description: "id del platillo del menú (preferido) o su nombre." },
            qty: { type: "integer", minimum: 1 },
            mods: {
              type: "array",
              items: { type: "string" },
              description: "Modificadores, p.ej. ['con todo'] o ['sin cebolla','extra queso'].",
            },
          },
          required: ["item", "qty"],
        },
      },
    },
    required: ["items"],
  },
  handler: (input, ctx): ToolResult => {
    const menu = ctx.menu?.items ?? [];
    const reqItems = Array.isArray(input.items) ? (input.items as Array<Record<string, unknown>>) : [];
    const order = ctx.session.order;
    const agregados: unknown[] = [];
    const rechazados: unknown[] = [];

    for (const raw of reqItems) {
      const ref = String(raw.item ?? "");
      const qty = Math.max(1, Math.floor(Number(raw.qty ?? 1)));
      const mods = Array.isArray(raw.mods) ? (raw.mods as unknown[]).map(String) : [];
      const item = findItem(menu, ref);

      if (!item) {
        rechazados.push({ item: ref, motivo: "no_existe" });
        continue;
      }
      if (!item.disponible) {
        rechazados.push({ item: item.nombre_es, motivo: "agotado_86" });
        continue;
      }
      const { names, delta } = resolveMods(item, mods);
      const unit = unitPrice(item) + delta;
      const sig = item.id + "|" + names.join(",");
      const existing = order.lines.find((l) => l.id + "|" + l.mods.join(",") === sig);
      if (existing) {
        existing.qty += qty;
        existing.line_total = existing.unit_price * existing.qty;
      } else {
        order.lines.push({
          id: item.id,
          nombre_es: item.nombre_es,
          qty,
          mods: names,
          unit_price: unit,
          line_total: unit * qty,
        });
      }
      agregados.push({ nombre_es: item.nombre_es, qty, mods: names, unit_price: unit });
    }

    const totals = recompute(order.lines);
    order.subtotal = totals.subtotal;
    order.total = totals.total;
    return { ok: rechazados.length === 0, agregados, rechazados, order: summarize(ctx) };
  },
};

const create_order: ToolDef = {
  name: "create_order",
  description:
    "Finaliza el pedido. Llama solo DESPUÉS de confirmar artículos y total con el cliente. Recalcula el total del lado de la herramienta y asigna un folio. Tras esto, llama a emit_ticket.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["pickup", "delivery", "dine_in"] },
      time: { type: "string", description: "Hora de recoger/entrega/llegada, p.ej. '14:00'." },
      address: { type: "string", description: "Requerido para delivery." },
      name: { type: "string", description: "Nombre del cliente, opcional." },
    },
    required: ["type"],
  },
  handler: (input, ctx): ToolResult => {
    const order = ctx.session.order;
    if (order.lines.length === 0) {
      return { ok: false, error: "pedido_vacio", message: "No hay artículos en el pedido." };
    }
    const type = String(input.type) as ServiceType;
    const enabled = ctx.config.services;
    if (enabled && !enabled.includes(type)) {
      return { ok: false, error: "servicio_no_disponible", servicios: enabled };
    }
    if (type === "delivery" && !input.address) {
      return { ok: false, error: "falta_direccion", message: "Para entrega necesito la dirección." };
    }
    const totals = recompute(order.lines);
    order.subtotal = totals.subtotal;
    order.total = totals.total;
    order.service = {
      type,
      time: typeof input.time === "string" ? input.time : undefined,
      address: typeof input.address === "string" ? input.address : undefined,
    };
    order.customer = {
      name: typeof input.name === "string" ? input.name : ctx.session.profileName,
      phone: ctx.session.id.replace(/^whatsapp:/, ""),
    };
    ctx.session.ticketSeq += 1;
    order.order_id = `${ctx.config.ticket_prefix}${240 + ctx.session.ticketSeq}`;
    order.status = "confirmed";
    return {
      ok: true,
      order_id: order.order_id,
      type,
      time: order.service.time ?? null,
      total: order.total,
      currency: ctx.config.currency,
      next: "Llama a emit_ticket para mandarlo a cocina.",
    };
  },
};

const emit_ticket: ToolDef = {
  name: "emit_ticket",
  description:
    "Emite el ticket estructurado a cocina/POS para el pedido confirmado. Llamar inmediatamente después de create_order.",
  input_schema: {
    type: "object",
    properties: { order_id: { type: "string" }, notes: { type: "string" } },
  },
  handler: (input, ctx): ToolResult => {
    const order = ctx.session.order;
    if (!order.order_id || order.status === "building") {
      return { ok: false, error: "sin_pedido_confirmado", message: "Primero llama a create_order." };
    }
    const ticket: KitchenTicket = {
      ticket_id: order.order_id,
      channel: "whatsapp",
      business: ctx.config.business_name,
      created_at: ctx.now().toISOString(),
      service: {
        type: order.service?.type ?? "pickup",
        time: order.service?.time ?? null,
        address: order.service?.address ?? null,
      },
      customer: {
        name: order.customer?.name ?? null,
        phone: order.customer?.phone ?? null,
      },
      items: order.lines.map((l) => ({
        id: l.id,
        name: l.nombre_es,
        qty: l.qty,
        mods: l.mods,
        unit_price: l.unit_price,
        line_total: l.line_total,
      })),
      subtotal: order.subtotal,
      total: order.total,
      currency: ctx.config.currency,
      notes: typeof input.notes === "string" ? input.notes : "",
      status: "new",
    };
    ctx.emit("ticket", ticket as unknown as Record<string, unknown>);
    order.status = "sent";
    return { ok: true, ticket };
  },
};

const book_table: ToolDef = {
  name: "book_table",
  description: "Reserva una mesa. Confirma tamaño, fecha/hora, nombre y teléfono antes de reservar.",
  input_schema: {
    type: "object",
    properties: {
      size: { type: "integer", minimum: 1 },
      datetime: { type: "string", description: "Fecha y hora, p.ej. '2026-07-01 21:00'." },
      name: { type: "string" },
      tel: { type: "string" },
    },
    required: ["size", "datetime", "name", "tel"],
  },
  handler: (input, ctx): ToolResult => {
    const res = {
      id: `R-${100 + ctx.session.reservations.length + 1}`,
      size: Math.max(1, Math.floor(Number(input.size ?? 2))),
      datetime: String(input.datetime ?? ""),
      name: String(input.name ?? ctx.session.profileName ?? ""),
      tel: String(input.tel ?? ctx.session.id.replace(/^whatsapp:/, "")),
    };
    ctx.session.reservations.push(res);
    ctx.emit("reservation", { ...res, business: ctx.config.business_name });
    return { ok: true, reservation_id: res.id, ...res };
  },
};

const handoff_human: ToolDef = {
  name: "handoff_human",
  description:
    "Transfiere a una persona del equipo (quejas, casos médicos/alergias serias, fuera de alcance). Incluye motivo y un resumen breve.",
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
    return {
      ok: true,
      handed_off: true,
      message: "Un compañero del equipo continuará contigo en breve. 🙌",
    };
  },
};

export const restaurantTools: ToolDef[] = [
  get_menu,
  add_to_order,
  create_order,
  emit_ticket,
  book_table,
  handoff_human,
];
