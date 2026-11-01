import { describe, expect, test } from "vitest";
import { signPayload, TOLERANCE_SECONDS, verifyPayload } from "./hmac";

const secret = "test-secret";
const now = 1_800_000_000;
const timestamp = String(now);
const rawBody = '{"loanId":"abc","status":"sent"}';

async function verify(overrides: Partial<Parameters<typeof verifyPayload>[0]> = {}) {
  const signature = await signPayload(secret, timestamp, rawBody);
  return verifyPayload({ secret, timestamp, signature, rawBody, nowSeconds: now, ...overrides });
}

describe("HMAC sign and verify", () => {
  test("accepts a correctly signed payload", async () => {
    expect(await verify()).toEqual({ ok: true });
  });

  test("matches an independently computed vector", async () => {
    // printf '1800000000.{"a":1}' | openssl dgst -sha256 -hmac test-secret
    expect(await signPayload(secret, timestamp, '{"a":1}')).toBe(
      "fd0477e9ec1e4d22c67d1989918181dfecfc9bdaec888e8a1b1d7890869b30e6",
    );
  });

  test("rejects a re-serialized body even though it is the same JSON", async () => {
    const reserialized = JSON.stringify(JSON.parse(rawBody), null, 1);
    expect(JSON.parse(reserialized)).toEqual(JSON.parse(rawBody));
    expect(await verify({ rawBody: reserialized })).toEqual({ ok: false, reason: "bad_signature" });
  });

  test("rejects reordered keys", async () => {
    expect(await verify({ rawBody: '{"status":"sent","loanId":"abc"}' })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  test("rejects the wrong secret", async () => {
    expect(await verify({ secret: "other-secret" })).toEqual({ ok: false, reason: "bad_signature" });
  });

  test("rejects a modified timestamp, because it is part of the signed bytes", async () => {
    expect(await verify({ timestamp: String(now + 1) })).toEqual({ ok: false, reason: "bad_signature" });
  });

  test("rejects stale and far-future timestamps", async () => {
    expect(await verify({ nowSeconds: now + TOLERANCE_SECONDS + 1 })).toEqual({ ok: false, reason: "stale" });
    expect(await verify({ nowSeconds: now - TOLERANCE_SECONDS - 1 })).toEqual({ ok: false, reason: "stale" });
  });

  test("accepts a timestamp exactly at the tolerance", async () => {
    expect(await verify({ nowSeconds: now + TOLERANCE_SECONDS })).toEqual({ ok: true });
  });

  test.each([
    ["missing signature", { signature: null }],
    ["non-hex signature", { signature: "z".repeat(64) }],
    ["short signature", { signature: "ab" }],
    ["missing timestamp", { timestamp: null }],
    ["non-numeric timestamp", { timestamp: "yesterday" }],
    ["empty secret", { secret: "" }],
  ])("rejects %s as malformed", async (_label, overrides) => {
    expect(await verify(overrides)).toEqual({ ok: false, reason: "malformed" });
  });

  test("a signed route only verifies for that route", async () => {
    const signature = await signPayload(secret, timestamp, rawBody, "POST /n8n/activity");
    const check = (scope?: string) => verifyPayload({ secret, timestamp, signature, rawBody, scope, nowSeconds: now });
    expect(await check("POST /n8n/activity")).toEqual({ ok: true });
    expect(await check("GET /n8n/overdue-loans")).toEqual({ ok: false, reason: "bad_signature" });
    expect(await check()).toEqual({ ok: false, reason: "bad_signature" });
  });

  test("a string and its UTF-8 bytes sign identically, including non-ASCII", async () => {
    const body = '{"tool":"Sägeblatt 🔧"}';
    expect(await signPayload(secret, timestamp, body)).toBe(
      await signPayload(secret, timestamp, new TextEncoder().encode(body)),
    );
  });
});
