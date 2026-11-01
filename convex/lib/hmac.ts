/**
 * HMAC-SHA256 signing shared by both directions of the Convex <-> n8n link.
 *
 *   signature = hex( HMAC-SHA256( secret, "<unix seconds>." + <raw body bytes> ) )
 *
 * n8n -> Convex requests also sign their route, "<unix seconds>.<METHOD> <path>." + body,
 * so a captured request cannot be replayed against a different endpoint. Convex -> n8n
 * has a single webhook and keeps the shorter form; each direction has its own secret.
 *
 * The timestamp is inside the signed bytes, so it cannot be changed to refresh an
 * old request. We sign bytes rather than parsed JSON because re-serializing can
 * reorder keys or change whitespace, which would change the signature.
 *
 * Uses Web Crypto, available in Convex and in Node, so tests run the real code.
 */

export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const SIGNATURE_HEADER = "x-lendloop-signature";
export const TOLERANCE_SECONDS = 300;

export type VerifyFailure = "malformed" | "stale" | "bad_signature";
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

const encoder = new TextEncoder();

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

function signedBytes(timestamp: string, rawBody: string | Uint8Array, scope?: string) {
  const prefix = encoder.encode(scope ? `${timestamp}.${scope}.` : `${timestamp}.`);
  const body = typeof rawBody === "string" ? encoder.encode(rawBody) : rawBody;
  const bytes = new Uint8Array(prefix.length + body.length);
  bytes.set(prefix);
  bytes.set(body, prefix.length);
  return bytes;
}

export async function signPayload(
  secret: string,
  timestamp: string,
  rawBody: string | Uint8Array,
  scope?: string,
): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    await importKey(secret, "sign"),
    signedBytes(timestamp, rawBody, scope),
  );
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPayload(args: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string | Uint8Array;
  /** "<METHOD> <path>" for routes that sign it. */
  scope?: string;
  nowSeconds?: number;
}): Promise<VerifyResult> {
  const { secret, timestamp, signature, rawBody, scope } = args;
  if (!secret) return { ok: false, reason: "malformed" }; // never accept an empty key
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "malformed" };
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: "malformed" };

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const expected = Uint8Array.from(signature.match(/../g)!, (byte) => parseInt(byte, 16));
  // subtle.verify compares in constant time, so we never hand-roll the comparison.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await importKey(secret, "verify"),
    expected,
    signedBytes(timestamp, rawBody, scope),
  );
  return valid ? { ok: true } : { ok: false, reason: "bad_signature" };
}
