// Twilio WhatsApp adapter — zero-dependency. Inbound webhook is form-encoded;
// we reply with TwiML in the same HTTP response (no outbound creds needed for
// the sandbox). Signature validation uses node:crypto.
import crypto from "node:crypto";

export interface Inbound {
  channel: "twilio";
  from: string; // E.164 with leading +, no "whatsapp:" prefix
  text: string;
  profileName?: string;
}

export function parseTwilioInbound(body: Record<string, string>): Inbound | null {
  const from = (body.From || "").replace(/^whatsapp:/, "");
  const text = body.Body || "";
  if (!from) return null;
  return { channel: "twilio", from, text, profileName: body.ProfileName };
}

/** Twilio's HMAC-SHA1 scheme: full URL + sorted (key+value) pairs, base64. */
export function validateTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toTwiML(replies: string[]): string {
  const messages = replies.map((r) => `<Message>${escapeXml(r)}</Message>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${messages}</Response>`;
}

/** Optional: send a WhatsApp message via Twilio REST (for proactive/async sends). */
export async function sendTwilio(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) throw new Error("Faltan credenciales de Twilio para envío REST.");
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio send falló: ${res.status} ${await res.text()}`);
}
