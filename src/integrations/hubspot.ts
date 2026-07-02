// HubSpot CRM integration — zero-dependency (uses global fetch).
// Creates/updates a contact and (optionally) an associated deal via the CRM v3
// API. No-ops until HUBSPOT_TOKEN is set.
function token(): string | null {
const t = process.env.HUBSPOT_TOKEN;
return t && !/REPLACE_ME/i.test(t) ? t : null;
}

/** True if the HubSpot integration is configured. */
export function hubspotConfigured(): boolean {
return token() !== null;
}

const digits = (s?: string) => (s ? s.replace(/[^\d]/g, "") : "");

export interface Contact {
firstname?: string;
lastname?: string;
email?: string;
phone?: string;
/** free-text context (operation, zone, order id…) → stored on the contact's note field */
note?: string;
leadStatus?: string; // e.g. NEW, IN_PROGRESS
}

/**
* Upsert a HubSpot contact. Dedupes by email (a phone-derived pseudo-email when
* no real email is known, which is typical for WhatsApp leads). Fire-and-forget,
* never throws. Returns the HubSpot contact id on success (so a caller can
* associate a deal with it), or null if the integration is off / the call failed.
*/
export async function upsertContact(c: Contact): Promise<string | null> {
const t = token();
if (!t) return null;
const email = c.email || (c.phone ? `wa-${digits(c.phone)}@leadgen.mx` : undefined);
if (!email && !c.phone) return null; // nothing to identify the contact with

const properties: Record<string, string> = {};
if (email) properties.email = email;
if (c.firstname) properties.firstname = c.firstname;
if (c.lastname) properties.lastname = c.lastname;
if (c.phone) properties.phone = c.phone;
if (c.note) properties.message = c.note;
if (c.leadStatus) properties.hs_lead_status = c.leadStatus;

const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
try {
const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
method: "POST",
headers: auth,
body: JSON.stringify({ properties }),
});
if (res.ok) {
const created = (await res.json()) as { id?: string };
console.log(`[hubspot] contact created: ${email ?? c.phone}`);
return created.id ?? null;
}
if (res.status === 409) {
// Already exists → HubSpot returns the existing id in the error message.
const err = (await res.json()) as { message?: string };
const id = err.message?.match(/Existing ID:\s*(\d+)/)?.[1] ?? null;
if (id) {
const upd = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
method: "PATCH",
headers: auth,
body: JSON.stringify({ properties }),
});
if (upd.ok) console.log(`[hubspot] contact updated: ${email ?? c.phone}`);
else console.error("[hubspot] update error:", upd.status, (await upd.text()).slice(0, 160));
}
return id;
}
console.error("[hubspot] contact error:", res.status, (await res.text()).slice(0, 200));
return null;
} catch (e) {
console.error("[hubspot] upsertContact:", e instanceof Error ? e.message : e);
return null;
}
}

export interface Deal {
dealname: string;
/** HubSpot contact id to associate this deal with, if known. */
contactId?: string | null;
amount?: number;
note?: string;
/** Defaults to the account's standard Sales pipeline + first stage. */
pipeline?: string;
dealstage?: string;
}

/**
* Create a HubSpot deal, optionally associated with a contact via the CRM v3
* associations payload (association type 3 = "deal to contact", a HubSpot
* default). Fire-and-forget, never throws — no-ops until HUBSPOT_TOKEN is set.
*/
export async function createDeal(d: Deal): Promise<string | null> {
const t = token();
if (!t) return null;

const properties: Record<string, string> = {
dealname: d.dealname,
pipeline: d.pipeline ?? "default",
dealstage: d.dealstage ?? "appointmentscheduled",
};
if (d.amount != null) properties.amount = String(d.amount);
if (d.note) properties.description = d.note;

const body: Record<string, unknown> = { properties };
if (d.contactId) {
body.associations = [
{
to: { id: d.contactId },
types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
},
];
}

try {
const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
method: "POST",
headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
body: JSON.stringify(body),
});
if (res.ok) {
const created = (await res.json()) as { id?: string };
console.log(`[hubspot] deal created: ${d.dealname}${d.contactId ? ` (linked to contact ${d.contactId})` : ""}`);
return created.id ?? null;
}
console.error("[hubspot] deal error:", res.status, (await res.text()).slice(0, 200));
return null;
} catch (e) {
console.error("[hubspot] createDeal:", e instanceof Error ? e.message : e);
return null;
}
}
