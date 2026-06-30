// Shared domain types. Built-in imports only — runs under `node --experimental-strip-types`.

export type ServiceType = "pickup" | "delivery" | "dine_in";
export type ToolPackName = "restaurant" | "realestate";

// ─── Menu (restaurant knowledge) ───────────────────────────────────
export interface MenuModifier {
  id: string;
  nombre_es: string;
  precio_mxn?: number; // delta added to the line; omit/0 for free mods
}
export interface MenuItem {
  id: string;
  nombre_es: string;
  categoria: string;
  precio_mxn: number;
  descripcion_es?: string;
  modificadores?: MenuModifier[];
  alergenos?: string[];
  promo?: { precio_mxn: number; etiqueta_es: string } | null;
  disponible: boolean; // false === 86'd; the agent will not sell it
}
export interface Menu {
  moneda: string;
  categorias: string[];
  items: MenuItem[];
}

// ─── Order state (lives in the session, mutated by tools) ──────────
export interface OrderLine {
  id: string;
  nombre_es: string;
  qty: number;
  mods: string[];
  unit_price: number; // resolved tool-side (promo aware)
  line_total: number; // unit_price * qty (+ paid mods)
}
export interface OrderState {
  lines: OrderLine[];
  service?: { type: ServiceType; time?: string; address?: string };
  customer?: { name?: string; phone?: string };
  subtotal: number;
  total: number;
  status: "building" | "confirmed" | "sent";
  order_id?: string;
}

export interface Reservation {
  id: string;
  size: number;
  datetime: string;
  name: string;
  tel: string;
}

// ─── Real-estate knowledge (the white-label flip) ──────────────────
export type Operacion = "renta" | "venta";
export interface Listing {
  id: string;
  titulo_es: string;
  operacion: Operacion;
  zona: string;
  recamaras: number;
  banos: number;
  m2: number;
  precio_mxn: number;
  amenidades?: string[];
  disponible: boolean;
}

// ─── Conversation transcript (kept SDK-agnostic on purpose) ────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: unknown; // string or content-block array (Anthropic shape)
}

export interface Session {
  id: string; // channel user id, e.g. "whatsapp:+5215555555555"
  businessSlug: string;
  profileName?: string;
  messages: ChatMessage[];
  order: OrderState;
  reservations: Reservation[];
  ticketSeq: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Business config (the white-label surface) ─────────────────────
export interface BusinessConfig {
  slug: string;
  business_name: string;
  industry: string;
  locale: string;
  currency: string;
  tool_pack: ToolPackName;
  knowledge: { menu?: string; listings?: string };
  ticket_prefix: string;
  services?: ServiceType[];
  hours?: { open: string; close: string; days_es?: string };
  upsell?: { enabled: boolean; rules_es: string[] };
  persona_es: string;
  greeting_es?: string;
  branding?: { emoji?: string; color?: string };
}

// ─── Tool plumbing ─────────────────────────────────────────────────
export interface ToolContext {
  session: Session;
  config: BusinessConfig;
  emit: (event: string, payload: Record<string, unknown>) => void;
  now: () => Date;
  // LIVE catalog for this turn, fetched from Postgres by the agent runtime and
  // injected here so tool handlers stay synchronous + deterministic.
  menu?: Menu;
  listings?: Listing[];
}
export interface ToolResult {
  ok: boolean;
  [k: string]: unknown;
}
export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, ctx: ToolContext) => ToolResult;
}

// ─── Structured kitchen / POS ticket (the deliverable) ─────────────
export interface KitchenTicket {
  ticket_id: string;
  channel: string;
  business: string;
  created_at: string;
  service: { type: ServiceType; time: string | null; address: string | null };
  customer: { name: string | null; phone: string | null };
  items: Array<{
    id: string;
    name: string;
    qty: number;
    mods: string[];
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  total: number;
  currency: string;
  notes: string;
  status: "new";
}
