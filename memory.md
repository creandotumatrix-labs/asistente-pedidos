# memory.md — Asistente de Pedidos (session handoff)

> Read this first. It's the full context for the WhatsApp ordering + reservation agent
> built in the prior session, so a forked session can continue without re-deriving anything.
> Last updated: 2026-06-29.
>
> **Repo:** https://github.com/adventurewave-labs/asistente-pedidos (private). The build
> sandbox can't reach GitHub, so the push runs from the Cowork outputs folder on the Mac.

## What this is

A WhatsApp agent (CDMX Spanish) that takes food orders, upsells, computes totals
**deterministically tool-side (never LLM math)**, books tables, and emits a structured
kitchen/POS ticket — then **flips one config line** (`BUSINESS=…`) to become a real-estate
agent on the *same runtime*. The config flip is the sales pitch: one backend, white-labeled.

**Context:** building this to demo *tomorrow* to win a client. Sourced from "PRD 2 — Restaurant
Ordering + Reservation Agent" (codename *Asistente de Pedidos*), a stretch/demo-pairing PRD
designed to run on the same backend as a real-estate agent (PRD 1).

## Decisions locked (from the 3-way clarifying question)

1. **Channel = real WhatsApp**, both **Twilio** and **Meta Cloud API** adapters (demo on
   Twilio sandbox / Meta test number — instant, no business verification).
2. **Scope = restaurant + white-label config flip** (taquería ⇄ real-estate, plus a
   fine-dining persona config to show tone range).
3. **Engine = live Claude API** (real tool-use loop), with a **deterministic offline scripted
   demo** as the bulletproof stage fallback.

### Architecture decisions
- **Node 20+/TypeScript**, ESM. Runs on Node's **native type-stripping**
  (`node --experimental-strip-types`); `tsx` only for the dev server. → domain logic, tests,
  validate, and the offline demo run with **zero `npm install`**.
- **Two runtime deps only**: `@anthropic-ai/sdk`, `express`. Channel adapters (Twilio/Meta)
  are **hand-rolled, zero-dep** (manual HMAC-SHA1 sig + TwiML + Graph fetch); env via native
  `process.loadEnvFile`. Fewer install points to fail on stage.
- **Shared runtime, swappable tool packs.** `src/agent.ts` is the only SDK importer and is
  identical for every business. A `configs/*.json` selects persona + rules + `tool_pack` +
  knowledge file. This is what makes the white-label claim real.
- **Deterministic money** lives in `src/tools/restaurant.ts` (promo-aware, paid modifiers,
  86'd items). The model is told never to do arithmetic; tools are the source of truth.
- **Live ops board** via SSE (`/events` → `web/kitchen.html`); tools emit business events
  (`ticket`/`reservation`/`viewing`/`lead`/`handoff`) onto an in-process bus.

## Layout (project root: `asistente-pedidos/`)

```
configs/  taqueria-el-pastor.json · la-mesa-fina.json (fine-dining persona) · inmobiliaria-cdmx.json (the flip)
data/     menu.taqueria.json (22 items, promos, 2× 86'd) · menu.finedining.json · listings.cdmx.json (8 props)
schemas/  ticket.schema.json  (structured kitchen/POS ticket contract, JSON Schema 2020-12)
src/
  agent.ts        shared Claude tool-use loop (ONLY SDK importer); MODEL env, MAX_STEPS=6
  prompt.ts       builds persona + rules + grounded menu/inventory from the active config
  tools/restaurant.ts  get_menu, add_to_order, create_order, emit_ticket, book_table, handoff_human
  tools/realestate.ts  get_listings, schedule_viewing, qualify_lead, handoff_human
  tools/index.ts  registry: tool_pack → ToolDef[]; toAnthropicTools() (SDK-free)
  channels/twilio.ts   inbound parse + HMAC-SHA1 validate + TwiML reply (zero-dep)
  channels/meta.ts     inbound parse + verify handshake + Graph send v22.0 (zero-dep)
  server.ts       webhook routes (/webhook/twilio, /webhook/meta) + SSE /events + /kitchen + /config + /healthz
  config.ts session.ts bus.ts types.ts
web/kitchen.html  live ops board (SSE, animated cards, WebAudio ding, branding from /config)
scripts/  simulate.ts (live REPL + --script offline demo) · test.ts · validate.ts · check-channels.ts
README.md  full deploy + architecture          DEMO.md  stage cue-card (exact es-MX lines)
```

## Status — what's verified vs not

**Verified in-sandbox (no network, no install):**
- `scripts/test.ts` — **15/15** deterministic tests green. PRD order (3 pastor + horchata +
  guac promo) asserts **exactly $170**. Covers promos ($55→$45), paid mods (+$12), line
  merge, 86'ing, unknown-item rejection, folio prefix, delivery-needs-address,
  ticket-schema conformance, real-estate filtering/viewing/lead, per-config service rules,
  run-to-run determinism.
- `scripts/check-channels.ts` — **5/5** (TwiML escaping, Twilio inbound parse, Twilio sig
  accept/reject, Meta inbound parse, Meta verify handshake).
- `scripts/validate.ts` — all 3 configs + menus/listings load; PRD math = $170.
- `node --experimental-strip-types --check` passes on **every** `.ts`; `web/kitchen.html`
  inline JS parses.

**NOT yet verified (blocked: npm registry 403 in sandbox; needs Marcus's machine):**
- Live end-to-end agent loop against the real Anthropic API (needs `ANTHROPIC_API_KEY`).
- `npm install` + `npm run typecheck` (tsc with `@types/*`).
- `npm start` express boot + a real WhatsApp round-trip (needs ngrok + channel creds).
- The `Anthropic.MessageParam`/`Tool`/`ToolUseBlock`/`ToolResultBlockParam` type references in
  `agent.ts` are the standard SDK namespace types — confirm on first `npm run typecheck`.

## How to run

```bash
npm install
cp .env.example .env       # ANTHROPIC_API_KEY (+ channel creds); MODEL=claude-sonnet-4-6
npm run validate           # preflight
npm test                   # 15 + 5 checks
npm run demo               # offline scripted taquería flow (real tools, $170) — stage fallback
npm run simulate           # live REPL vs real model
npm start                  # server + board on :8080  → http://localhost:8080/kitchen
# flip: set BUSINESS=inmobiliaria-cdmx in .env, restart → same engine, real-estate agent
```

Default model `claude-sonnet-4-6` (Haiku `claude-haiku-4-5-20251001` for cost/latency, Opus
`claude-opus-4-8` for hardest reasoning).

## Open items / next steps (phase-2 backlog)

- **Demo dry-run on real hardware**: `npm install`, `npm run typecheck`, then a live WhatsApp
  round-trip through Twilio sandbox + projector board. (Highest priority before the pitch.)
- **Webhook idempotency + retries**: Meta retries on non-200; de-dup by message id. Add a
  processed-message set per session.
- **Persistence**: `SessionStore` is an in-memory `Map` (single interface to swap for
  Redis/Postgres). Needed for multi-instance / restart durability.
- **Multi-tenant by number**: today one `BUSINESS` per process. To serve many businesses on
  one deployment, key the config by inbound `To`/phone-number-id instead of env.
- **Voice channel**: PRD calls it out ("llama para ordenar"); same tools, add a
  Twilio Voice / speech adapter.
- **Observability + rate limiting + outbound send-failure handling** for production.
- **Phase-2 per PRD (explicitly out of MVP)**: live POS integration (Toast/Square), payment
  links, delivery dispatch, inventory-driven 86'ing, loyalty.

## Gotchas / notes for the next session

- Sandbox **cannot `npm install`** (registry 403) and **cannot `rm`** in the outputs mount
  (deletion is gated; Marcus declined a delete prompt — respect his "don't delete without
  confirming" rule). Two safe-to-delete leftovers exist: `scripts/_chk.ts` (now a thin alias
  of `check-channels.ts`) and a `src/tools/.fuse_hidden…` orphan from an in-place edit.
- All relative imports use explicit **`.ts`** extensions (required by Node type-stripping;
  also fine for tsx/tsc with `allowImportingTsExtensions`).
- Keep modules outside `agent.ts`/`server.ts` **SDK-free and built-in-only** so they keep
  running under `node --experimental-strip-types` without install. Don't import the Anthropic
  SDK or express into the tool packs / config / session / bus.
- Menu prices are tuned so the PRD triplet = **$170** (pastor 30, horchata 35, guac promo 45);
  changing them will break a test assertion in `scripts/test.ts` — update both together.
