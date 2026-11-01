// Sends webhooks to n8n the way Convex does, including attacks that must be rejected.
//   node scripts/send-test-webhook.mjs <valid|replay|forged|stale|reserialized|tampered>
// Imports the app's real signing code. Node 22.18+ runs the .ts file directly.
import { SIGNATURE_HEADER, signPayload, TIMESTAMP_HEADER } from "../convex/lib/hmac.ts";

process.loadEnvFile(".env");
const { env } = process;
const mode = process.argv[2] ?? "valid";
const payload = {
  eventId: `notify:test${Date.now()}:pending`,
  status: "pending",
  toolName: "Test tool",
  startDate: "2030-01-01",
  endDate: "2030-01-02",
  recipientEmail: "someone@example.test",
  recipientFirstName: "Someone",
};
const now = Math.floor(Date.now() / 1000);
const body = JSON.stringify(payload);

const secret = mode === "forged" ? "not-the-real-secret" : env.CONVEX_TO_N8N_SECRET;
const timestamp = String(mode === "stale" ? now - 3600 : now);
const signature = await signPayload(secret, timestamp, body);
const sent = {
  reserialized: JSON.stringify(payload, null, 2), // same JSON, different bytes
  tampered: body.replace("Test tool", "Changed tool"),
}[mode] ?? body;

const send = async () => {
  const response = await fetch(env.N8N_REQUEST_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature },
    body: sent,
  });
  console.log(`${mode}: HTTP ${response.status} ${await response.text()}`);
};
await send();
// Same request twice: the claim must let only one send through.
if (mode === "replay") await send();
