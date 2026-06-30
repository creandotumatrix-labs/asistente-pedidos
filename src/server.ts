// Webhook server + live ops feed. One runtime; BUSINESS env decides which
// config is live; CHANNEL env decides Twilio vs Meta. Flip either, restart, done.
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

// Native .env loading (Node >=20.6) — no dotenv dependency.
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* no .env present — env may be set another way */
}

const PORT = Number(process.env.PORT || 8080);
const BUSINESS = process.env.BUSINESS || "taqueria-el-pastor";
const CHANNEL = (process.env.CHANNEL || "twilio").toLowerCase();

const config = loadConfig(BUSINESS);
const store = new SessionStore();
const app = express();

const RESET_WORDS = new Set(["reset", "reiniciar", "reinicia", "nuevo", "nuevo pedido", "/reset", "empezar"]);

// ── live feed backlog so a board opened mid-demo still sees recent events ──
const backlog: FeedEvent[] = [];
bus.on("feed", (e: FeedEvent) => {
  backlog.push(e);
  if (backlog.length > 30) backlog.shift();
});

// ── shared inbound handler for every channel ──────────────────────────────
async function handleInbound(inbound: TwilioInbound | MetaInbound): Promise<string[]> {
  const id = `whatsapp:${inbound.from}`;
  const text = (inbound.text || "").trim();

  if (RESET_WORDS.has(text.toLowerCase())) {
    store.reset(id);
    emitFeed("session_reset", { session: id });
    return [config.greeting_es ?? "¡Listo, empecemos de nuevo!"];
  }

  const session = store.get(id, BUSINESS, inbound.profileName);
  if (!text) return [config.greeting_es ?? "¡Hola!"];

  const emit = (event: string, payload: Record<string, unknown>) => emitFeed(event, payload);
  try {
    return await runAgent(session, text, emit);
  } catch (e) {
    console.error("[agent] error:", e);
    return ["Uy, tuve un problemita técnico 🙈. ¿Me lo repites en un momento?"];
  }
}

// ── Twilio webhook (replies via TwiML in the same response) ───────────────
app.post("/webhook/twilio", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  if (process.env.TWILIO_VALIDATE_SIGNATURE === "true" && process.env.TWILIO_AUTH_TOKEN) {
    const url = (process.env.PUBLIC_URL || "") + req.originalUrl;
    const ok = validateTwilioSignature(process.env.TWILIO_AUTH_TOKEN, req.header("X-Twilio-Signature"), url, body);
    if (!ok) return res.status(403).send("Firma inválida");
  }
  const inbound = parseTwilioInbound(body);
  if (!inbound) return res.type("text/xml").send(toTwiML([]));
  const replies = await handleInbound(inbound);
  return res.type("text/xml").send(toTwiML(replies));
});

// ── Meta webhook (verify on GET, ack fast + send via REST on POST) ────────
app.get("/webhook/meta", (req: Request, res: Response) => {
  const challenge = verifyMetaChallenge(req.query as Record<string, unknown>);
  if (challenge) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook/meta", express.json(), async (req: Request, res: Response) => {
  res.sendStatus(200); // acknowledge immediately
  const inbound = parseMetaInbound(req.body);
  if (!inbound) return;
  const replies = await handleInbound(inbound);
  for (const r of replies) {
    try {
      await sendMeta(inbound.from, r);
    } catch (e) {
      console.error("[meta] send error:", e);
    }
  }
});

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

// ── Board UI + meta ───────────────────────────────────────────────────────
app.get("/config", (_req: Request, res: Response) => {
  res.json({
    slug: config.slug,
    business_name: config.business_name,
    industry: config.industry,
    tool_pack: config.tool_pack,
    currency: config.currency,
    channel: CHANNEL,
    branding: config.branding ?? {},
  });
});

app.get("/kitchen", (_req: Request, res: Response) => {
  res.type("html").send(readFileSync(join(projectRoot(), "web", "kitchen.html"), "utf8"));
});

app.get("/healthz", (_req: Request, res: Response) => res.json({ ok: true, business: config.slug, channel: CHANNEL }));
app.get("/", (_req: Request, res: Response) => res.redirect("/kitchen"));

app.listen(PORT, () => {
  console.log(`\n  🌮  Asistente de Pedidos`);
  console.log(`  ├─ negocio:  ${config.business_name}  (${config.slug} · ${config.tool_pack})`);
  console.log(`  ├─ canal:    ${CHANNEL}`);
  console.log(`  ├─ modelo:   ${process.env.MODEL || "claude-sonnet-4-6"}`);
  console.log(`  ├─ board:    http://localhost:${PORT}/kitchen`);
  console.log(`  └─ webhook:  ${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/webhook/${CHANNEL}\n`);
});
