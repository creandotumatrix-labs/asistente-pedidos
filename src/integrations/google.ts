// Google Calendar integration — zero-dependency. Signs a service-account JWT
// with Node's crypto, exchanges it for an access token, and inserts events.
// No-ops (silently) until GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID are set.
import crypto from "node:crypto";

interface SA {
client_email: string;
private_key: string;
}

function creds(): SA | null {
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!raw || /REPLACE_ME/i.test(raw)) return null;
try {
const j = JSON.parse(raw) as SA;
if (j.client_email && j.private_key) return j;
} catch {
/* not valid JSON yet */
}
return null;
}

function calendarId(): string | null {
const c = process.env.GOOGLE_CALENDAR_ID;
return c && !/REPLACE_ME/i.test(c) ? c : null;
}

/** True if the calendar integration is fully configured. */
export function googleConfigured(): boolean {
return creds() !== null && calendarId() !== null;
}

const b64url = (s: string) => Buffer.from(s).toString("base64url");

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string | null> {
const c = creds();
if (!c) return null;
const now = Math.floor(Date.now() / 1000);
if (cached && cached.exp > now + 60) return cached.token;

const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claim = b64url(
JSON.stringify({
iss: c.client_email,
scope: "https://www.googleapis.com/auth/calendar",
aud: "https://oauth2.googleapis.com/token",
iat: now,
exp: now + 3600,
}),
);
const key = c.private_key.replace(/\\n/g, "\n");
const sig = crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key).toString("base64url");
const jwt = `${header}.${claim}.${sig}`;

const res = await fetch("https://oauth2.googleapis.com/token", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
});
const data = (await res.json()) as { access_token?: string; expires_in?: number };
if (!data.access_token) {
console.error("[google] token error:", JSON.stringify(data).slice(0, 200));
return null;
}
cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
return data.access_token;
}

// Mexico abolished nationwide DST in 2022 — Mexico City sits at a fixed
// UTC-6 year-round, so a static offset is correct (not just an approximation).
const AGENDA_UTC_OFFSET = "-06:00";

/**
* Lenient datetime parse for free-text like "2026-07-02 17:00". The system
* prompt always hands the model this exact "YYYY-MM-DD HH:MM" shape and tells
* it to reason in America/Mexico_City wall-clock time — but a bare string like
* that has no timezone info, so JS's Date parser fell back to the *server's*
* local time (UTC on Railway), silently shifting every event 6 hours early.
* Anchor the expected shape to Mexico City's offset explicitly before parsing;
* only fall back to the ambiguous parse for anything that doesn't match it.
*/
function parseWhen(when?: string): Date {
if (when) {
const m = when.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
if (m) {
const [, date, hm] = m;
const anchored = new Date(`${date}T${hm}:00${AGENDA_UTC_OFFSET}`);
if (!isNaN(anchored.getTime())) return anchored;
}
const d1 = new Date(when.replace(" ", "T"));
if (!isNaN(d1.getTime())) return d1;
const d2 = new Date(when);
if (!isNaN(d2.getTime())) return d2;
}
const t = new Date();
t.setDate(t.getDate() + 1);
t.setHours(12, 0, 0, 0);
return t;
}

export interface CalEvent {
summary: string;
description?: string;
when?: string;
durationMin?: number;
}

/** Create a Google Calendar event. Fire-and-forget; never throws. */
export async function createCalendarEvent(ev: CalEvent): Promise<void> {
const calId = calendarId();
if (!calId) return;
try {
const token = await getAccessToken();
if (!token) return;
const start = parseWhen(ev.when);
const end = new Date(start.getTime() + (ev.durationMin ?? 60) * 60 * 1000);
const res = await fetch(
`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
{
method: "POST",
headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
body: JSON.stringify({
summary: ev.summary,
description: ev.description ?? "",
start: { dateTime: start.toISOString() },
end: { dateTime: end.toISOString() },
}),
},
);
if (!res.ok) console.error("[google] event error:", res.status, (await res.text()).slice(0, 200));
else console.log(`[google] calendar event created: ${ev.summary}`);
} catch (e) {
console.error("[google] createCalendarEvent:", e instanceof Error ? e.message : e);
}
}
