# 🌮 Asistente de Pedidos — Pedidos y Reservaciones por WhatsApp (es-MX)

Un agente de WhatsApp que toma pedidos de comida en español de CDMX, hace upsell, calcula el total **determinísticamente (del lado de la herramienta, nunca con el LLM)**, reserva mesas, y emite un ticket estructurado de cocina/POS — y con **un solo cambio de config** se convierte en un agente inmobiliario sobre el **mismo motor exacto**. Ese cambio es la propuesta: un solo backend, white-label para cualquier negocio.

*A WhatsApp agent that takes food orders in CDMX Spanish, upsells, computes the total deterministically (tool-side, never LLM math), books tables, and emits a structured kitchen/POS ticket — then flips one config line to become a real-estate agent on the exact same engine.*

```
WhatsApp ──▶ webhook (Twilio | Meta) ──▶ shared Claude tool-use runtime ──▶ tools ──▶ evento estructurado
   ▲                                              │                          (ticket / reservación /
   └──────────── respuesta (es-MX) ◀──────────────┘                           visita / lead)
                                                                                     │
                                          tablero de operación en vivo (SSE)  ◀──────┘
```

El runtime, los adaptadores de canal, la sesión, el ensamblado del prompt y el bus de eventos son **idénticos** para cada negocio. Un negocio es solo un `configs/*.json` (persona + reglas + qué paquete de herramientas + archivo de conocimiento). Cambia el config → nuevo negocio en minutos.

---

## Demo

![Demo en vivo — Asistente de Pedidos](asistente-pedidos-demo-v2.gif)

- 🔴 **Demo en vivo (tablero de cocina):** [asistente-pedidos-production.up.railway.app/kitchen](https://asistente-pedidos-production.up.railway.app/kitchen)
- 📄 **Detalles:** [asistente-pedidos-showcase.vercel.app](https://asistente-pedidos-showcase.vercel.app/)
- 🎤 **Guión de pitch en vivo:** ver [DEMO.md](DEMO.md) — cue-card de escenario, minuto a minuto.

---

## Quickstart

```bash
npm install
cp .env.example .env          # agrega ANTHROPIC_API_KEY (+ credenciales de canal)
npm run validate              # preflight: configs, menú, matemática del PRD = $170
npm test                      # 15 tests determinísticos + 5 smoke checks de canal
npm run demo                  # flujo de taquería offline con guión (tu respaldo sin internet)
npm start                     # levanta el servidor webhook + tablero de operación en :8080
```

Abre el proyector en **http://localhost:8080/kitchen**, escríbele al número de WhatsApp, mira el ticket aparecer en vivo.

---

## Deploy en 5 minutos

Necesitas: Node ≥ 20, un `ANTHROPIC_API_KEY`, y un túnel HTTPS público (`ngrok http 8080`). Elige **un** canal — ambos aprovisionan un número de WhatsApp usable al instante, sin verificación de negocio para la demo.

### Opción A — Twilio WhatsApp Sandbox (la más rápida)

1. `.env`: `CHANNEL=twilio`, `BUSINESS=taqueria-el-pastor`, `TWILIO_VALIDATE_SIGNATURE=false` *(el sandbox responde vía TwiML, no se necesitan credenciales salientes de Twilio para arrancar)*.
2. `npm start`, luego `ngrok http 8080` y copia la URL `https://…ngrok…`.
3. **Twilio Console → Messaging → Try it out → WhatsApp sandbox settings.** En *"When a message comes in"* pon `https://<ngrok>/webhook/twilio` (HTTP **POST**).
4. Desde tu teléfono, envía por WhatsApp al número sandbox (`+1 415 523 8886`) el código que muestra la consola (p.ej. `join silver-tiger`).
5. Escríbele: *"buenas, quiero pedir"* → ya estás en vivo.

*Para activar validación de firma: `TWILIO_VALIDATE_SIGNATURE=true`, `TWILIO_AUTH_TOKEN=…`, `PUBLIC_URL=https://<ngrok>`.*

### Opción B — Meta WhatsApp Cloud API (número de prueba gratis)

1. **developers.facebook.com** → crear app (tipo *Business*) → agregar **WhatsApp**. Copia el `phone_number_id` del **número de prueba**, un **access token** temporal, y agrega tu número personal como destinatario permitido (modo de prueba permite hasta 5).
2. `.env`: `CHANNEL=meta`, `META_PHONE_NUMBER_ID=…`, `META_ACCESS_TOKEN=…`, `META_VERIFY_TOKEN=<cualquier-string>`, `META_GRAPH_VERSION=v22.0`.
3. `npm start` + `ngrok http 8080`.
4. En el producto WhatsApp → **Configuration → Webhook**, pon la URL de callback `https://<ngrok>/webhook/meta` y el verify token igual a tu `META_VERIFY_TOKEN`; **suscríbete a `messages`**.
5. Escríbele al número de prueba desde tu teléfono permitido.

> **Nota de producción (post-demo):** un número de producción *con marca* requiere verificación de negocio de Meta (días, no horas) en cualquiera de los dos canales. El número sandbox/prueba de arriba es la herramienta correcta para un pitch en vivo; llevar el número a producción es un paso aparte.

---

## Por qué esta arquitectura vende

- **Dinero determinístico.** Totales, promos (guac $55→$45), modificadores pagados (+$12 queso) y items 86'd se calculan en `src/tools/restaurant.ts` — el modelo *nunca* hace aritmética. Probado por `npm test` (el pedido del PRD se verifica en exactamente `$170`).
- **Grounded.** El agente solo vende items reales y disponibles del menú a precios reales; el menú se inyecta en el system prompt y se hace cumplir en las herramientas.
- **Un motor, muchos negocios.** `taqueria-el-pastor`, `la-mesa-fina` (persona fine-dining), `inmobiliaria-cdmx` (inmobiliaria) corren todos el mismo `src/agent.ts`.
- **Salida estructurada.** `emit_ticket` produce un contrato JSON listo para POS (`schemas/ticket.schema.json`) que cualquier pantalla de cocina o POS puede consumir.

*Deterministic totals computed tool-side, grounded to a real menu, one engine serving multiple businesses via config, structured JSON output any POS can consume.*

---

## Estructura del proyecto

```
configs/                  la superficie white-label — un JSON por negocio
  taqueria-el-pastor.json  · restaurante: pedidos, upsell, reservaciones, ticket
  la-mesa-fina.json        · herramientas de restaurante, persona fine-dining
  inmobiliaria-cdmx.json   · herramientas inmobiliarias (el flip)
data/                     archivos de conocimiento referenciados por los configs
  menu.taqueria.json       · menú CDMX de 22 items, promos + 2 items 86'd
  menu.finedining.json     · menú pequeño y elevado
  listings.cdmx.json       · 8 propiedades CDMX (renta/venta)
schemas/ticket.schema.json contrato estructurado de ticket cocina/POS (JSON Schema)
src/
  agent.ts                 el loop de tool-use de Claude compartido (único importador del SDK)
  prompt.ts                arma persona + reglas + conocimiento grounded desde el config
  tools/restaurant.ts      get_menu, add_to_order, create_order, emit_ticket, book_table, handoff_human
  tools/realestate.ts      get_listings, schedule_viewing, qualify_lead, handoff_human
  channels/twilio.ts       parseo inbound + firma HMAC-SHA1 + respuesta TwiML (sin dependencias)
  channels/meta.ts         parseo inbound + verify handshake + envío por Graph (sin dependencias)
  server.ts                rutas webhook + feed SSE de operación + tablero
  config.ts session.ts bus.ts types.ts
web/kitchen.html           el tablero de operación en vivo (SSE, animado, suena)
scripts/                   simulate (REPL + demo offline), test, validate, check-channels
```

## Comandos

| comando | qué hace |
|---|---|
| `npm run validate` | preflight de cada config/menú/listing; verifica la matemática del PRD |
| `npm test` | 15 tests determinísticos de dominio + 5 smoke checks de canal (sin red) |
| `npm run demo` | flujo de taquería offline con guión, con herramientas reales — **respaldo de escenario** |
| `npm run simulate` | REPL en vivo contra el modelo real (requiere `ANTHROPIC_API_KEY`) |
| `npm run simulate -- --business=inmobiliaria-cdmx` | REPL como el agente inmobiliario |
| `npm start` | levanta el servidor webhook + tablero de operación |
| `npm run typecheck` | `tsc --noEmit` (necesita `npm install` para `@types`) |

## Modelo y costo

`MODEL=claude-sonnet-4-6` por default — el punto dulce de latencia/calidad para un agente de WhatsApp ágil. Baja a `claude-haiku-4-5-20251001` para menor costo/latencia, o `claude-opus-4-8` para el razonamiento más difícil. Cada turno es corto (`max_tokens: 1024`) y el menú se inyecta una sola vez, así que el costo por pedido es bajo.

## Guardrails (en herramientas + prompt)

Solo vende items reales y **disponibles** a precios reales · totales calculados del lado de la herramienta · confirma pedido completo + total antes de `create_order` · preguntas de alérgenos/médicas se responden desde los datos del menú o se escalan (sin consejo médico) · pedidos fuera de horario se agendan · `handoff_human` para lo que quede fuera de alcance.

## Notas

- Corre en **TypeScript vía type-stripping nativo de Node** — `tsx` solo se usa por conveniencia del server de desarrollo; los scripts de test/validate/demo corren en `node` estándar.
- El estado de sesión está en memoria (un `Map`) para la demo. Cambia `SessionStore` por Redis/Postgres en producción — una sola interfaz, un solo archivo.
- `scripts/_chk.ts` es un alias obsoleto de `scripts/check-channels.ts`; seguro de borrar.
- Fuera de alcance (fase 2, según el PRD): integración POS en vivo, links de pago, dispatch de entrega, 86'd por inventario, lealtad.

---

## Preguntas frecuentes / FAQ

**¿Funciona con mi número de WhatsApp actual?** — Sí, vía WhatsApp Cloud API (Meta) o Twilio. Un número de producción con marca necesita verificación de negocio de Meta (días, no horas); el sandbox/número de prueba funciona al instante para una demo.
*Yes, via WhatsApp Cloud API or Twilio — a branded production number needs Meta business verification; the sandbox/test number works instantly for a demo.*

**¿Cuánto cuesta?** — Depende del negocio (menú/catálogo, canal, integraciones). Escríbenos vía [creandotumatrix.com](https://creandotumatrix.com) para una cotización.
*Depends on the business — contact us via creandotumatrix.com for a quote.*

**¿Puedo usarlo para otro negocio que no sea restaurante?** — Sí — ese es el punto. `inmobiliaria-cdmx` corre sobre el mismo motor solo cambiando el config; cualquier vertical con un catálogo/inventario + flujo de agendado aplica.
*Yes — that's the point. The real-estate config runs on the same engine with no code changes.*

**¿El total del pedido lo calcula el modelo?** — No, nunca. Todo el cálculo de dinero vive en `src/tools/restaurant.ts`; `npm test` verifica el pedido del PRD en exactamente $170.
*No — all money math lives in the tool layer, never the model.*

---

## Asistentes CTM — la familia / the family

Los tres agentes de WhatsApp de **Creando Tu Matrix**, todos sobre el mismo patrón: runtime de tool-use con Claude, guardrails determinísticos en código, y una superficie de configuración white-label por negocio.

| Agente | Qué hace | Repo |
|---|---|---|
| 🌮 **asistente-pedidos** | Pedidos y reservaciones por WhatsApp para restaurantes | [creandotumatrix-labs/asistente-pedidos](https://github.com/creandotumatrix-labs/asistente-pedidos) |
| 🛍️ **asistente-de-tienda** | Soporte y ventas de retail/ecommerce, sobre catálogo real | [creandotumatrix-labs/asistente-de-tienda](https://github.com/creandotumatrix-labs/asistente-de-tienda) |
| 📈 **asistente-comercial** | Calificación y agendado de leads, agnóstico al vertical | [creandotumatrix-labs/asistente-comercial](https://github.com/creandotumatrix-labs/asistente-comercial) |

*The three Creando Tu Matrix WhatsApp agents, all on the same pattern: a Claude tool-use runtime, deterministic guardrails in code, and a per-business white-label config surface.*

🌐 Más sobre CTM: [creandotumatrix.com](https://creandotumatrix.com) · Org: [creandotumatrix-labs](https://github.com/creandotumatrix-labs)

---

Construido por [Marcus Patman](https://github.com/marcuspat) — Principal Agentic Engineer · Parte de **Asistentes CTM** en [creandotumatrix-labs](https://github.com/creandotumatrix-labs)
