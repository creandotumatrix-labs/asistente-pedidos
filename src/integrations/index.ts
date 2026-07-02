// Integrations wiring — subscribes to the event bus and pushes the agent's
// structured events to Google Calendar + HubSpot. Decoupled from the tools:
// nothing in the agent loop changes; this just listens. Each call is
// fire-and-forget and no-ops until its credentials are set.
import { bus, type FeedEvent } from "../bus.ts";
import { createCalendarEvent, googleConfigured } from "./google.ts";
import { upsertContact, createDeal, hubspotConfigured } from "./hubspot.ts";

let wired = false;

export function wireIntegrations(): void {
if (wired) return;
wired = true;

bus.on("feed", (e: FeedEvent) => {
const p = (e.payload ?? {}) as Record<string, unknown>;
const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
const biz = s("business") ?? "";

switch (e.type) {
case "viewing": {
// Real-estate property visit → calendar event + CRM contact.
const prop = s("titulo_es") ?? s("listing_id") ?? "propiedad";
void createCalendarEvent({
summary: `Visita — ${prop}`,
description: `Prospecto: ${s("name") ?? ""} · Tel: ${s("tel") ?? ""} · Zona: ${s("zona") ?? ""} · ${biz}`,
when: s("datetime"),
});
void upsertContact({ firstname: s("name"), phone: s("tel"), note: `Visita: ${prop} (${s("zona") ?? ""})`, leadStatus: "IN_PROGRESS" });
break;
}
case "reservation": {
// Restaurant table booking → calendar event + CRM contact + CRM deal
// (deal is associated to the contact once the contact upsert resolves).
const name = s("name") ?? "";
const size = p.size ?? "?";
void createCalendarEvent({
summary: `Reservación — ${name} (${size}p)`,
description: `${biz} · Tel: ${s("tel") ?? ""}`,
when: s("datetime"),
});
void (async () => {
const contactId = await upsertContact({
firstname: name,
phone: s("tel"),
note: `Reservación mesa (${size}p)`,
});
await createDeal({
dealname: `Reservación — ${name} (${size}p)`,
contactId,
note: `${biz} · mesa para ${size}p · ${s("datetime") ?? ""}`,
});
})();
break;
}
case "lead": {
// Qualified prospect → CRM contact.
void upsertContact({
firstname: s("name"),
phone: s("tel"),
note: `Lead ${s("operacion") ?? ""} · ${s("zona") ?? ""} · presupuesto ${p.presupuesto_max ?? "—"} · tier ${s("tier") ?? ""}`,
leadStatus: "NEW",
});
break;
}
case "ticket": {
// Order placed → CRM contact for the customer.
const cust = (p.customer ?? {}) as Record<string, unknown>;
void upsertContact({
firstname: typeof cust.name === "string" ? cust.name : undefined,
phone: typeof cust.phone === "string" ? cust.phone : undefined,
note: `Pedido ${s("ticket_id") ?? ""} — $${p.total ?? ""} ${s("currency") ?? ""}`,
});
break;
}
}
});

console.log(
`[integrations] wired · Google Calendar: ${googleConfigured() ? "on" : "off (set GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID)"} · HubSpot: ${hubspotConfigured() ? "on" : "off (set HUBSPOT_TOKEN)"}`,
);
}
