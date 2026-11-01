import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { shouldApply } from "./lib/automationState";
import { daysBetween } from "./lib/dates";
import { eventKindValidator, eventStatusValidator } from "./lib/domain";

type EventInput = Pick<Doc<"automationEvents">, "idempotencyKey" | "kind" | "status"> & {
  loanId?: Id<"loans">;
  detail?: string;
};

export async function recordEvent(ctx: MutationCtx, input: EventInput) {
  const existing = await ctx.db
    .query("automationEvents")
    .withIndex("by_key", (q) => q.eq("idempotencyKey", input.idempotencyKey))
    .unique();
  if (!shouldApply(existing?.status, input.status)) {
    return { applied: false, status: existing?.status };
  }
  const updatedAt = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { status: input.status, detail: input.detail, updatedAt });
  } else {
    await ctx.db.insert("automationEvents", { ...input, updatedAt });
  }
  return { applied: true, status: input.status };
}

export const recordActivity = internalMutation({
  args: {
    idempotencyKey: v.string(),
    kind: eventKindValidator,
    status: eventStatusValidator,
    loanId: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { loanId: rawLoanId, ...event }) => {
    if (!/^(notify|reminder|error):[\w:.-]{1,128}$/.test(event.idempotencyKey)) {
      throw new ConvexError("Invalid idempotency key.");
    }
    const loanId = rawLoanId ? ctx.db.normalizeId("loans", rawLoanId) : undefined;
    if (rawLoanId && !loanId) throw new ConvexError("Unknown loan.");
    return recordEvent(ctx, {
      ...event,
      detail: event.detail?.slice(0, 500),
      ...(loanId ? { loanId } : {}),
    });
  },
});

export const STUCK_AFTER_MS = 15 * 60_000;

/**
 * Runs from a cron. A crash between claim and write-back, or a delivery action that dies
 * mid-run, would otherwise leave a row "queued" or "sending" forever. Marking it failed
 * makes it visible on the Admin page and lets a later run claim it again.
 */
export const expireStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_AFTER_MS;
    let expired = 0;
    for (const status of ["queued", "sending"] as const) {
      const stuck = await ctx.db
        .query("automationEvents")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status).lt("updatedAt", cutoff))
        .take(100);
      for (const event of stuck) {
        await ctx.db.patch(event._id, {
          status: "failed",
          detail: status === "queued" ? "Never delivered to n8n" : "No result reported; outcome unknown",
          updatedAt: Date.now(),
        });
      }
      expired += stuck.length;
    }
    if (expired > 0) console.warn(`[automation] marked ${expired} stuck event(s) failed`);
    return expired;
  },
});

// `today` is an argument because Convex caches query results and passing time does not
// refresh them. With Date.now() here, the daily run could receive yesterday's list.
export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const overdue = await ctx.db
      .query("loans")
      .withIndex("by_status_endDate", (q) => q.eq("status", "approved").lt("endDate", today))
      .take(200); // Oldest 200 only. Paginate if a run could ever exceed that.

    const rows = await Promise.all(
      overdue.map(async (loan) => {
        const idempotencyKey = `reminder:${loan._id}:${today}`;
        const event = await ctx.db
          .query("automationEvents")
          .withIndex("by_key", (q) => q.eq("idempotencyKey", idempotencyKey))
          .unique();
        if (event?.status === "sent" || event?.status === "sending") return null;
        const [tool, borrower] = await Promise.all([ctx.db.get(loan.toolId), ctx.db.get(loan.borrowerId)]);
        if (!tool || !borrower) return null;
        return {
          idempotencyKey,
          loanId: loan._id as string,
          toolName: tool.name,
          dueDate: loan.endDate,
          daysOverdue: daysBetween(loan.endDate, today),
          borrowerEmail: borrower.email,
          borrowerFirstName: borrower.name.split(" ")[0],
        };
      }),
    );
    return rows.filter((row) => row !== null);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("automationEvents").withIndex("by_updatedAt").order("desc").take(50);
  },
});
