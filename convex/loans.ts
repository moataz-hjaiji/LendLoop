import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authorize, canCancelLoan, canDecideLoan, requireAdmin, requireUser } from "./lib/auth";
import { assertValidRange, rangesOverlap, todayUtc } from "./lib/dates";
import type { LoanStatus } from "./lib/domain";
import { enqueueNotification } from "./notifications";

const MAX_LIST = 100;

// Transitions only move forward. That keeps "notify:<loanId>:<status>" unique, which
// is what makes it usable as an idempotency key.
const ALLOWED_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  pending: ["approved", "declined", "cancelled"],
  approved: ["returned"],
  declined: [],
  cancelled: [],
  returned: [],
};

async function findOverlappingApprovedLoan(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  range: { startDate: string; endDate: string },
) {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
  const today = todayUtc();
  // A loan past its end date still holds the tool until the lender confirms the return.
  return approved.find((loan) =>
    rangesOverlap({ startDate: loan.startDate, endDate: loan.endDate < today ? today : loan.endDate }, range),
  );
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const viewer = await requireUser(ctx);
    assertValidRange(startDate, endDate, todayUtc());

    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt !== undefined) throw new ConvexError("Tool not found.");
    if (tool.ownerId === viewer._id) throw new ConvexError("You cannot borrow your own tool.");

    const range = { startDate, endDate };
    if (await findOverlappingApprovedLoan(ctx, toolId, range)) {
      throw new ConvexError("This tool is already booked for those dates.");
    }
    const pending = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .collect();
    if (pending.some((loan) => loan.borrowerId === viewer._id && rangesOverlap(loan, range))) {
      throw new ConvexError("You already have a pending request for those dates.");
    }

    const loan = {
      toolId,
      ownerId: tool.ownerId,
      borrowerId: viewer._id,
      startDate,
      endDate,
      status: "pending",
    } as const;
    const loanId = await ctx.db.insert("loans", loan);
    await enqueueNotification(ctx, { ...loan, _id: loanId }, tool);
    return loanId;
  },
});

async function loadForTransition(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  next: LoanStatus,
  isAllowed: (viewer: Doc<"users">, loan: Doc<"loans">) => boolean,
) {
  const viewer = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Loan not found.");
  authorize(isAllowed(viewer, loan));
  if (!ALLOWED_TRANSITIONS[loan.status].includes(next)) {
    throw new ConvexError(`A ${loan.status} loan cannot become ${next}.`);
  }
  const tool = await ctx.db.get(loan.toolId);
  if (!tool) throw new ConvexError("Tool not found.");
  return { loan, tool };
}

async function applyTransition(
  ctx: MutationCtx,
  { loan, tool }: { loan: Doc<"loans">; tool: Doc<"tools"> },
  next: LoanStatus,
) {
  await ctx.db.patch(loan._id, { status: next });
  await enqueueNotification(ctx, { ...loan, status: next }, tool);
}

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const target = await loadForTransition(ctx, loanId, "approved", canDecideLoan);
    if (target.loan.endDate < todayUtc()) {
      throw new ConvexError("The dates of this request have passed. Decline it instead.");
    }
    // Convex mutations are serializable: two simultaneous approvals both read this
    // index, so one is retried, sees the other's loan and fails here. No double booking.
    if (await findOverlappingApprovedLoan(ctx, target.loan.toolId, target.loan)) {
      throw new ConvexError("Those dates overlap a loan you already approved.");
    }
    await applyTransition(ctx, target, "approved");
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await applyTransition(ctx, await loadForTransition(ctx, loanId, "declined", canDecideLoan), "declined");
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await applyTransition(ctx, await loadForTransition(ctx, loanId, "cancelled", canCancelLoan), "cancelled");
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await applyTransition(ctx, await loadForTransition(ctx, loanId, "returned", canDecideLoan), "returned");
  },
});

/** Adds display fields. Email is shared only with the other party, and only once approved. */
async function withDetails(ctx: QueryCtx, loan: Doc<"loans">) {
  const [tool, owner, borrower, events] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.ownerId),
    ctx.db.get(loan.borrowerId),
    ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .order("desc")
      .take(5),
  ]);
  const shareContact = loan.status === "approved";
  return {
    ...loan,
    toolName: tool?.name ?? "Removed tool",
    ownerName: owner?.name ?? "Unknown",
    ownerEmail: shareContact ? owner?.email : undefined,
    borrowerName: borrower?.name ?? "Unknown",
    borrowerEmail: shareContact ? borrower?.email : undefined,
    overdue: loan.status === "approved" && loan.endDate < todayUtc(),
    activity: events.map(({ _id, kind, status, updatedAt }) => ({ _id, kind, status, updatedAt })),
  };
}

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .take(MAX_LIST);
    return Promise.all(loans.map((loan) => withDetails(ctx, loan)));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .take(MAX_LIST);
    return Promise.all(loans.map((loan) => withDetails(ctx, loan)));
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(MAX_LIST);
    return Promise.all(loans.map((loan) => withDetails(ctx, loan)));
  },
});
