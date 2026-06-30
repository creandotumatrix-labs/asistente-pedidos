# Unleashing it in a Codespace

Codespaces replaces ngrok: a forwarded port gives you a public HTTPS webhook URL for free.
The `.devcontainer/` pins **Node 22** (required — the `test`/`demo`/`validate` scripts use
native TS type-stripping, 22.6+) and runs `npm install` on create.

## 0 · Open
Push this folder to a repo → **Code ▸ Codespaces ▸ Create codespace**. The devcontainer builds
and installs deps automatically.

## 1 · First-run checklist — retire the 3 unverified risks *before* touching WhatsApp
These are the only things the build sandbox couldn't exercise. Run them first; each is fast.

```bash
npm run typecheck     # ① TS + Anthropic SDK types compile (needs the install — done for you)
npm test              # ② 15 deterministic + 5 channel checks (no network)
npm run validate      # ③ configs/menu/listings load, PRD math = $170
```

Then the big one — **the live Claude tool-use loop**, which has never run end-to-end:

```bash
# add your key (Codespaces secret ANTHROPIC_API_KEY is auto-injected; or put it in .env)
npm run simulate
#   type: 3 tacos de pastor y un agua de horchata
#         va        (accept the guac upsell)
#         para llevar, 2pm
#   → you should see the agent converse AND a 🎫 ticket JSON print. That retires the risk.
```

If `npm run simulate` orders cleanly and prints a ticket, the system is **proven real** end to
end. Everything else below is just plumbing WhatsApp into the same loop.

## 2 · Secrets & env
- **`ANTHROPIC_API_KEY`** — add as a Codespaces secret (Settings ▸ Codespaces ▸ Secrets) so it's
  injected as an env var, or `cp .env.example .env` and paste it. The server reads
  `process.env.ANTHROPIC_API_KEY` either way.
- Channel creds → `.env` (`cp .env.example .env`).

## 3 · Expose the webhook (the ngrok replacement)
1. `npm start` (listens on `:8080`).
2. **Ports** tab → port **8080** is auto-forwarded → right-click → **Port Visibility ▸ Public**
   *(must be Public, or WhatsApp can't reach it).*
3. Copy the URL, e.g. `https://<codespace>-8080.app.github.dev`. Put it in `.env` as
   `PUBLIC_URL`, and use it as the webhook base.

## 4 · Wire WhatsApp (pick one)
- **Twilio sandbox:** Console ▸ Messaging ▸ WhatsApp sandbox ▸ *When a message comes in* →
  `https://<codespace>-8080.app.github.dev/webhook/twilio` (POST). Join the sandbox from your
  phone, then message it.
- **Meta Cloud API:** WhatsApp ▸ Configuration ▸ Webhook →
  `https://<codespace>-8080.app.github.dev/webhook/meta`, verify token = `META_VERIFY_TOKEN`,
  subscribe to `messages`.

## 5 · Run the demo
- Board: open forwarded **8080** → `/kitchen` in the browser, click **🔔 Sonido** once.
- Order on WhatsApp → ticket lands live.
- The flip: set `BUSINESS=inmobiliaria-cdmx` in `.env`, restart `npm start`, reload the board.

## Gotchas
- **Node 22 required** for `npm test`/`demo`/`validate` (native type-stripping). The devcontainer
  handles it; if you run elsewhere, use Node ≥ 22.6.
- Forwarded ports default to **private** — WhatsApp webhooks need the port set to **Public**.
- The Codespaces secret must be named exactly **`ANTHROPIC_API_KEY`**.
- Restarting the Codespace can change the forwarded URL → update the webhook + `PUBLIC_URL`.
  (For Twilio signature validation, `PUBLIC_URL` must match the URL Twilio actually calls, or set
  `TWILIO_VALIDATE_SIGNATURE=false` for the sandbox.)
