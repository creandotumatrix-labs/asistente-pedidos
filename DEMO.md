# 🎤 Stage cue-card — keep this open during the pitch

## 90 seconds before you start
- [ ] `npm run validate` → green ("Todo listo para el demo 🚀")
- [ ] `npm start` running · phone joined to the WhatsApp number
- [ ] Projector on **http://localhost:8080/kitchen** · click **🔔 Sonido** once (enables the ding)
- [ ] Phone screen mirrored / visible to the room
- [ ] Terminal tab ready on `npm run demo` in case the wifi dies

---

## ACT 1 — Order tacos (the relatable wow) · ~60s
Type these on the phone, one message at a time. Pause so the room reads each reply.

| You send | Watch for |
|---|---|
| `buenas, quiero pedir para llevar` | warm CDMX greeting 🌮 |
| `3 tacos de pastor y un agua de horchata` | it reads back the order, asks "¿con todo?" |
| `sí, con todo` | **the upsell lands** → guacamole en promo a $45 |
| `va` | itemized order + **Total: $170** |
| `para llevar, 2pm` | folio **#A-241** ✅ **ticket pops on the board** (ding) |

**Say it:** *"The total is computed by the tool, not the model — it's always right. And that
ticket on the screen is the exact JSON a POS or kitchen display consumes."*

### Prove the guardrail (optional, 10s)
| You send | Watch for |
|---|---|
| `¿tienen quesabirria?` | it's **86'd** → won't sell it, offers alternatives |

---

## ACT 2 — The flip (the business wow) · ~45s
At the terminal:
```
Ctrl-C                       # stop the server
# edit .env →  BUSINESS=inmobiliaria-cdmx
npm start                    # same code, new config
```
Reload the board. Same WhatsApp number, type:

| You send | Watch for |
|---|---|
| `hola, busco depa en renta en la Condesa` | real-estate concierge tone 🏠 |
| `2 recámaras, hasta 40 mil` | real listings from inventory (RN-01…) |
| `agéndame una visita el jueves 5pm` | **viewing card** on the same board |

**Say it (the closer):**
> *"Same backend. We changed one config file. Your taquería client and your real-estate client
> run on one system we build and maintain once. That's the white-label model — flip a config,
> new business, minutes not months."*

---

## If the wifi dies — don't sweat it
```
npm run demo
```
Runs the full taquería flow in the terminal with the **real tools** — real $170 total, real
emitted ticket JSON. Narrate it the same way. (And `npm test` will show the math is provably
correct, live.)

## One-liners to have in your pocket
- *"It only sells what's on the menu, at the real price. It can't hallucinate a dish or a total."*
- *"Spanish-first, built for CDMX — tone, modismos, the whole thing."*
- *"WhatsApp today; the same tools drop straight onto voice — phone ordering is huge for food."*
- *"Build effort for a new restaurant: a menu file, a persona, an upsell rule. That's the sale."*
