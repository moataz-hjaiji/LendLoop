import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyPayload } from "./lib/hmac";

const MAX_BODY_BYTES = 64 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Every n8n -> Convex route goes through here, so a route cannot forget to verify.
 * The signature is checked over the raw bytes, before the body is parsed.
 */
function signedRoute(handler: (ctx: ActionCtx, rawBody: string) => Promise<Response>) {
  return httpAction(async (ctx, request) => {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

    const result = await verifyPayload({
      secret: process.env.N8N_TO_CONVEX_SECRET ?? "",
      timestamp: request.headers.get(TIMESTAMP_HEADER),
      signature: request.headers.get(SIGNATURE_HEADER),
      rawBody: bytes,
    });
    if (!result.ok) {
      // The reason goes to our logs only, so callers learn nothing about why they failed.
      console.warn(`[http] rejected ${new URL(request.url).pathname}: ${result.reason}`);
      return json({ error: "unauthorized" }, 401);
    }
    return handler(ctx, new TextDecoder().decode(bytes));
  });
}

const http = httpRouter();

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: signedRoute(async (ctx) => {
    return json({ loans: await ctx.runQuery(internal.automation.overdueLoans, { today: todayUtc() }) });
  }),
});

http.route({
  path: "/n8n/activity",
  method: "POST",
  handler: signedRoute(async (ctx, rawBody) => {
    try {
      const { idempotencyKey, kind, status, loanId, detail } = JSON.parse(rawBody);
      // recordActivity's validators reject anything of the wrong type or value.
      return json(
        await ctx.runMutation(internal.automation.recordActivity, {
          idempotencyKey,
          kind,
          status,
          loanId,
          detail,
        }),
      );
    } catch (error) {
      console.warn(`[http] bad activity payload: ${error}`);
      const message = error instanceof ConvexError ? String(error.data) : "invalid_payload";
      return json({ error: message }, 400);
    }
  }),
});

export default http;
