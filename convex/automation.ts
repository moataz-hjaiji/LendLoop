import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { shouldApply } from "./lib/automationState";
import { daysBetween, todayUtc } from "./lib/dates";
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

export const overdueLoans = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayUtc();
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
