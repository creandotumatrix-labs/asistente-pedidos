// Channel-adapter smoke test — built-in only, no network, no SDK.
// Verifies TwiML escaping, inbound parsing, Twilio HMAC-SHA1 signature
// validation, and the Meta webhook verify handshake.
//   node --experimental-strip-types scripts/check-channels.ts
import { strict as assert } from "node:assert";
import crypto from "node:crypto";
import { toTwiML, validateTwilioSignature, parseTwilioInbound } from "../src/channels/twilio.ts";
import { parseMetaInbound, verifyMetaChallenge } from "../src/channels/meta.ts";

let pass = 0;
const ok = (n: string) => {
  pass++;
  console.log("  \x1b[32m✔\x1b[0m " + n);
};

// TwiML: escapes XML + one <Message> per reply
const xml = toTwiML(["Hola & <3", "Segundo"]);
assert.ok(xml.includes("&amp;") && (xml.match(/<Message>/g) || []).length === 2);
ok("TwiML escapa XML y emite un mensaje por respuesta");

// Twilio inbound parse strips the whatsapp: prefix
const inb = parseTwilioInbound({ From: "whatsapp:+5215550001111", Body: "hola", ProfileName: "Ana" });
assert.ok(inb && inb.from === "+5215550001111" && inb.text === "hola" && inb.profileName === "Ana");
ok("Twilio inbound se parsea correctamente");

// Twilio signature: accept valid, reject tampered
const token = "testtoken";
const url = "https://x.ngrok.app/webhook/twilio";
const params = { B: "2", A: "1", From: "whatsapp:+52" };
const data = Object.keys(params).sort().reduce((a, k) => a + k + (params as Record<string, string>)[k], url);
const sig = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
assert.ok(validateTwilioSignature(token, sig, url, params));
assert.ok(!validateTwilioSignature(token, "firma-mala", url, params));
ok("Firma Twilio válida aceptada, inválida rechazada");

// Meta inbound parse
const m = parseMetaInbound({
  entry: [{ changes: [{ value: { messages: [{ from: "5215550002222", text: { body: "hi" } }], contacts: [{ profile: { name: "Luis" } }] } }] }],
});
assert.ok(m && m.from === "+5215550002222" && m.text === "hi" && m.profileName === "Luis");
ok("Meta inbound se parsea correctamente");

// Meta verify handshake
process.env.META_VERIFY_TOKEN = "vt";
assert.equal(verifyMetaChallenge({ "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "42" }), "42");
assert.equal(verifyMetaChallenge({ "hub.mode": "subscribe", "hub.verify_token": "mal", "hub.challenge": "42" }), null);
ok("Handshake de verificación de Meta correcto");

console.log(`\n  ${pass} smoke-checks de canales OK\n`);
