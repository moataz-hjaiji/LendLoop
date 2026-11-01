import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, type MutationCtx } from "./_generated/server";
import { SIGNATURE_HEADER, signPayload, TIMESTAMP_HEADER } from "./lib/hmac";
import { recordEvent } from "./automation";

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

const firstName = (name: string) => name.split(" ")[0];

// Runs inside the mutation that changed the loan, so the status change, ledger row
// and scheduled send commit together.
export async function enqueueNotification(ctx: MutationCtx, loan: Omit<Doc<"loans">, "_creationTime">, tool: Doc<"tools">) {
  // Requests and cancellations go to the lender, the rest to the borrower.
  const toOwner = loan.status === "pending" || loan.status === "cancelled";
  const recipient = await ctx.db.get(toOwner ? loan.ownerId : loan.borrowerId);
  if (!recipient) throw new Error(`Loan ${loan._id} has no recipient`);

  const eventId = `notify:${loan._id}:${loan.status}`;
  await recordEvent(ctx, {
    idempotencyKey: eventId,
    kind: "notification",
    status: "queued",
    loanId: loan._id,
  });
  // Only the fields the message needs, listed explicitly.
  const payload = {
    eventId,
    loanId: loan._id as string,
    status: loan.status,
    toolName: tool.name,
    startDate: loan.startDate,
    endDate: loan.endDate,
    recipientEmail: recipient.email,
    recipientFirstName: firstName(recipient.name),
  };
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { payload, attempt: 1 });
}

// Sends one signed webhook, outside the user's mutation.
export const deliver = internalAction({
  args: {
    attempt: v.number(),
    payload: v.object({
      eventId: v.string(),
      loanId: v.string(),
      status: v.string(),
      toolName: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      recipientEmail: v.string(),
      recipientFirstName: v.string(),
    }),
  },
  handler: async (ctx, { payload, attempt }) => {
    let failure: string;
    let permanent = false;
    try {
      const url = process.env.N8N_REQUEST_WEBHOOK_URL;
      const secret = process.env.CONVEX_TO_N8N_SECRET;
      if (!url || !secret) throw new Error("N8N_REQUEST_WEBHOOK_URL or CONVEX_TO_N8N_SECRET is not set");

      // Re-signed on every attempt so the timestamp stays fresh.
      const body = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: await signPayload(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return;
      failure = `n8n responded ${response.status}`;
      // Retrying a 4xx won't help, except 408 and 429.
      permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    if (!permanent && attempt < MAX_ATTEMPTS) {
      // Backoff with jitter: ~5s, 15s, 45s, 2m15s.
      const delayMs = 5_000 * 3 ** (attempt - 1) * (0.8 + Math.random() * 0.4);
      console.warn(`[notify] ${payload.eventId} attempt ${attempt} failed: ${failure}`);
      await ctx.scheduler.runAfter(delayMs, internal.notifications.deliver, { payload, attempt: attempt + 1 });
      return;
    }
    console.error(`[notify] ${payload.eventId} gave up after ${attempt} attempts: ${failure}`);
    await ctx.runMutation(internal.automation.recordActivity, {
      idempotencyKey: payload.eventId,
      kind: "notification",
      status: "failed",
      detail: permanent ? `Not retried: ${failure}` : `Gave up after ${attempt} attempts: ${failure}`,
    });
  },
});
