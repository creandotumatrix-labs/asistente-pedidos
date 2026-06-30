// Webhook server + live ops feed. ONE deployment serves MANY businesses:
// the default is the BUSINESS env, and /webhook/<channel>/:biz +
// /kitchen?business=:biz select a business per request — that's the white-label
// flip, live, with no redeploy. CHANNEL env decides Twilio vs Meta.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import type { Request, Response } from "express";
import { bus, emitFeed, type FeedEvent } from "./bus.ts";
import { loadConfig, projectRoot } from "./config.ts";
import { SessionStore } from "./session.ts";
import { runAgent } from "./agent.ts";
import {
  parseTwilioInbound,
  validateTwilioSignature,
  toTwiML,
  type Inbound as TwilioInbound,
} from "./channels/twilio.ts";
import { parseMetaInbound, verifyMetaChallenge, sendMeta, type Inbound as MetaInbound } from "./channels/meta.ts";
import { migrate, saveTicket, saveEvent, dbEnabled } from "./db.ts";

// Native .env loading (Node >=20.6) — no dotenv dependency.
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* no .env present — env may be set another way */
}

const PORT = Number(process.env.PORT || 8080);
const BUSINESS = process.env.BUSINESS || "taqueria-el-pastor";
const CHANNEL = (process.env.CHANNEL || "twilio").toLowerCase();

// Businesses this deployment can serve (the white-label config surface).
const KNOWN_BUSINESSES = new Set(["taqueria-el-pastor", "la-mesa-fina", "inmobiliaria-cdmx"]);
function resolveBiz(slug?: string): string {
  return slug && KNOWN_BUSINESSES.has(slug) ? slug : BUSINESS;
}

const config = loadConfig(BUSINESS);
const store = new SessionStore();
const app = express();

const RESET_WORDS = new Set(["reset", "reiniciar", "reinicia", "nuevo", "nuevo pedido", "/reset", "empezar"]);

// ── live feed backlog so a board opened mid-demo still sees recent events ──
const backlog: FeedEvent[] = [];
bus.on("feed", (e: FeedEvent) => {
  backlog.push(e);
  if (backlog.length > 40) backlog.shift();
});

// Deterministic order confirmation, appended after a ticket emits so the customer
// ALWAYS gets a clean folio + total regardless of how the model phrases its reply.
function ticketConfirmation(t: Record<string, any>, emoji = "🌮"): string {
  const svc: Record<string, string> = { pickup: "para recoger", delivery: "entrega a domicilio", dine_in: "en sitio" };
  const when = t?.service?.time ? ` a las ${t.service.time}` : "";
  const name = t?.customer?.name ? `, ${t.customer.name}` : "";
  return `Listo ✅ Pedido *${t.ticket_id}* — ${svc[t?.service?.type] ?? "tu pedido"}${when}. Total: *$${t.total} ${t.currency}*. ¡Gracias${name}! ${emoji} Te avisamos cuando esté.`;
}

// ── shared inbound handler — businessSlug selects the active config ───────
async function handleInbound(inbound: TwilioInbound | MetaInbound, businessSlug: string): Promise<string[]> {
  const cfg = loadConfig(businessSlug);
  const id = `whatsapp:${inbound.from}|${businessSlug}`; // keep businesses' sessions separate
  const text = (inbound.text || "").trim();

  if (RESET_WORDS.has(text.toLowerCase())) {
    store.reset(id);
    emitFeed("session_reset", { session: id, business: cfg.business_name });
    return [cfg.greeting_es ?? "¡Listo, empecemos de nuevo!"];
  }

  const session = store.get(id, businessSlug, inbound.profileName);
  if (!text) return [cfg.greeting_es ?? "¡Hola!"];

  let ticket: Record<string, unknown> | null = null;
  const emit = (event: string, payload: Record<string, unknown>) => {
    emitFeed(event, payload);
    if (event === "ticket") {
      ticket = payload;
      void saveTicket(payload);
    } else {
      void saveEvent(event, payload);
    }
  };
  const snapshot = session.messages.length; // roll back a partial turn on error so the session stays valid
  try {
    const replies = await runAgent(session, text, emit);
    if (ticket) replies.push(ticketConfirmation(ticket, cfg.branding?.emoji));
    return replies;
  } catch (e) {
    session.messages.length = snapshot;
    console.error("[agent] error:", e);
    return ["Uy, tuve un problemita técnico 🙈. ¿Me lo repites en un momento?"];
  }
}

// ── Twilio webhook (replies via TwiML). /:biz selects business for the flip ──
async function twilioHandler(req: Request, res: Response, businessSlug: string) {
  const body = req.body as Record<string, string>;
  if (process.env.TWILIO_VALIDATE_SIGNATURE === "true" && process.env.TWILIO_AUTH_TOKEN) {
    const url = (process.env.PUBLIC_URL || "") + req.originalUrl;
    const ok = validateTwilioSignature(process.env.TWILIO_AUTH_TOKEN, req.header("X-Twilio-Signature"), url, body);
    if (!ok) return res.status(403).send("Firma inválida");
  }
  const inbound = parseTwilioInbound(body);
  if (!inbound) return res.type("text/xml").send(toTwiML([]));
  const replies = await handleInbound(inbound, businessSlug);
  return res.type("text/xml").send(toTwiML(replies));
}
app.post("/webhook/twilio", express.urlencoded({ extended: false }), (req, res) => twilioHandler(req, res, BUSINESS));
app.post("/webhook/twilio/:biz", express.urlencoded({ extended: false }), (req, res) =>
  twilioHandler(req, res, resolveBiz(req.params.biz)),
);

// ── Meta webhook (verify on GET, ack fast + send via REST on POST) ────────
function metaVerify(req: Request, res: Response) {
  const challenge = verifyMetaChallenge(req.query as Record<string, unknown>);
  if (challenge) return res.status(200).send(challenge);
  return res.sendStatus(403);
}
async function metaHandler(req: Request, res: Response, businessSlug: string) {
  res.sendStatus(200); // acknowledge immediately
  const inbound = parseMetaInbound(req.body);
  if (!inbound) return;
  const replies = await handleInbound(inbound, businessSlug);
  for (const r of replies) {
    try {
      await sendMeta(inbound.from, r);
    } catch (e) {
      console.error("[meta] send error:", e);
    }
  }
}
app.get("/webhook/meta", metaVerify);
app.get("/webhook/meta/:biz", metaVerify);
app.post("/webhook/meta", express.json(), (req, res) => metaHandler(req, res, BUSINESS));
app.post("/webhook/meta/:biz", express.json(), (req, res) => metaHandler(req, res, resolveBiz(req.params.biz)));

// ── Server-Sent Events: the live ops board subscribes here ────────────────
app.get("/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(`retry: 3000\n\n`);
  for (const e of backlog) res.write(`data: ${JSON.stringify(e)}\n\n`);

  const onFeed = (e: FeedEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on("feed", onFeed);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    bus.off("feed", onFeed);
  });
});

// ── Board UI + meta (business-aware via ?business=) ───────────────────────
app.get("/config", (req: Request, res: Response) => {
  const c = loadConfig(resolveBiz(typeof req.query.business === "string" ? req.query.business : undefined));
  res.json({
    slug: c.slug,
    business_name: c.business_name,
    industry: c.industry,
    tool_pack: c.tool_pack,
    currency: c.currency,
    channel: CHANNEL,
    branding: c.branding ?? {},
  });
});

app.get("/kitchen", (_req: Request, res: Response) => {
  res.type("html").send(readFileSync(join(projectRoot(), "web", "kitchen.html"), "utf8"));
});

app.get("/healthz", (_req: Request, res: Response) =>
  res.json({ ok: true, business: config.slug, channel: CHANNEL, businesses: [...KNOWN_BUSINESSES] }),
);
app.get("/", (_req: Request, res: Response) => res.redirect("/kitchen"));

async function start() {
  await migrate().catch((e) => console.error("[db] migración falló:", e));
  app.listen(PORT, () => {
    console.log(`\n  🌮  Asistente de Pedidos  (multi-negocio)`);
    console.log(`  ├─ default:  ${config.business_name}  (${config.slug})`);
    console.log(`  ├─ negocios: ${[...KNOWN_BUSINESSES].join(", ")}`);
    console.log(`  ├─ canal:    ${CHANNEL}`);
    console.log(`  ├─ modelo:   ${process.env.MODEL || "claude-sonnet-4-6"}`);
    console.log(`  ├─ db:       ${dbEnabled ? "postgres conectado" : "memoria (sin DATABASE_URL)"}`);
    console.log(`  └─ board:    http://localhost:${PORT}/kitchen\n`);
  });
}
start();
