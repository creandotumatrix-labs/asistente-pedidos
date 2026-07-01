// HubSpot CRM integration — zero-dependency (uses global fetch).
// Creates/updates a contact via the CRM v3 API. No-ops until HUBSPOT_TOKEN is set.
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
 * no real email is known, which is typical for WhatsApp leads). Fire-and-forget.
 */
export async function upsertContact(c: Contact): Promise<void> {
  const t = token();
  if (!t) return;
  const email = c.email || (c.phone ? `wa-${digits(c.phone)}@leadgen.mx` : undefined);
  if (!email && !c.phone) return; // nothing to identify the contact with

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
      console.log(`[hubspot] contact created: ${email ?? c.phone}`);
      return;
    }
    if (res.status === 409) {
      // Already exists → HubSpot returns the existing id in the error message.
      const err = (await res.json()) as { message?: string };
      const id = err.message?.match(/Existing ID:\s*(\d+)/)?.[1];
      if (id) {
        const upd = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
          method: "PATCH",
          headers: auth,
          body: JSON.stringify({ properties }),
        });
        if (upd.ok) console.log(`[hubspot] contact updated: ${email ?? c.phone}`);
        else console.error("[hubspot] update error:", upd.status, (await upd.text()).slice(0, 160));
      }
      return;
    }
    console.error("[hubspot] contact error:", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("[hubspot] upsertContact:", e instanceof Error ? e.message : e);
  }
}
