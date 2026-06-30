// Meta WhatsApp Cloud API adapter — zero-dependency.
// Inbound: webhook JSON (entry[].changes[].value.messages[]).
// Outbound: POST graph.facebook.com/{version}/{phoneId}/messages.
import type { Inbound as TwilioInbound } from "./twilio.ts";

export type Inbound = Omit<TwilioInbound, "channel"> & { channel: "meta" };

export function parseMetaInbound(body: unknown): Inbound | null {
  try {
    const b = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{ from?: string; text?: { body?: string }; type?: string }>;
            contacts?: Array<{ profile?: { name?: string } }>;
          };
        }>;
      }>;
    };
    const change = b.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (!msg?.from) return null;
    return {
      channel: "meta",
      from: msg.from.startsWith("+") ? msg.from : `+${msg.from}`,
      text: msg.text?.body ?? "",
      profileName: change?.contacts?.[0]?.profile?.name,
    };
  } catch {
    return null;
  }
}

/** GET webhook verification handshake. Returns the challenge string or null. */
export function verifyMetaChallenge(query: Record<string, unknown>): string | null {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return typeof challenge === "string" ? challenge : null;
  }
  return null;
}

export async function sendMeta(to: string, body: string): Promise<void> {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_VERSION || "v22.0";
  if (!phoneId || !token) throw new Error("Faltan credenciales de Meta (META_PHONE_NUMBER_ID / META_ACCESS_TOKEN).");
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) throw new Error(`Meta send falló: ${res.status} ${await res.text()}`);
}
