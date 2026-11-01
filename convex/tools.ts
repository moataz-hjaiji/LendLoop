import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authorize, canEditTool, canRemoveTool, requireUser } from "./lib/auth";
import { todayUtc } from "./lib/dates";
import { categoryValidator, conditionValidator } from "./lib/domain";
import { enqueueNotification } from "./notifications";

const MAX_LIST = 200; // shortcut: first 200 only, paginate past a neighborhood

const toolFields = {
  name: v.string(),
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
};

function cleanToolInput(input: { name: string; description: string }) {
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length < 2 || name.length > 80) throw new ConvexError("Name must be 2-80 characters.");
  if (description.length > 500) throw new ConvexError("Description must be under 500 characters.");
  return { name, description };
}

/** Availability today, plus booked ranges so the request form can warn before submitting. */
async function getAvailability(ctx: QueryCtx, toolId: Id<"tools">) {
  const today = todayUtc();
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
  // A loan past its end date still holds the tool until the lender confirms the return.
  const current = approved.find((loan) => loan.startDate <= today);
  return {
    state: !current ? "available" : current.endDate < today ? "overdue" : "on_loan",
    until: current?.endDate,
    booked: approved.map(({ startDate, endDate }) => ({ startDate, endDate })),
  } as const;
}

function activeTools(ctx: QueryCtx, category?: Doc<"tools">["category"]) {
  return ctx.db
    .query("tools")
    .withIndex("by_removed_category", (q) =>
      category ? q.eq("removedAt", undefined).eq("category", category) : q.eq("removedAt", undefined),
    )
    .take(MAX_LIST);
}

/** The only unauthenticated query. Returns an explicit allow-list of fields: no owner data. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await activeTools(ctx);
    const rows = await Promise.all(
      tools.map(async (tool) => ({ tool, availability: await getAvailability(ctx, tool._id) })),
    );
    return rows
      .filter(({ availability }) => availability.state === "available")
      .map(({ tool }) => ({ _id: tool._id, name: tool.name, category: tool.category }));
  },
});

export const list = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const viewer = await requireUser(ctx);
    const tools = await activeTools(ctx, category);
    return Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          ...tool,
          ownerName: owner?.name ?? "Unknown",
          ownerTrusted: owner?.trustedLender ?? false,
          isMine: tool.ownerId === viewer._id,
          availability: await getAvailability(ctx, tool._id),
        };
      }),
    );
  },
});

export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .take(MAX_LIST);
    const active = tools.filter((tool) => tool.removedAt === undefined);
    return Promise.all(
      active.map(async (tool) => ({ ...tool, availability: await getAvailability(ctx, tool._id) })),
    );
  },
});

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    return ctx.db.insert("tools", { ...args, ...cleanToolInput(args), ownerId: viewer._id });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...fields }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt !== undefined) throw new ConvexError("Tool not found.");
    authorize(canEditTool(viewer, tool));
    await ctx.db.patch(toolId, { ...fields, ...cleanToolInput(fields) });
  },
});

async function loansWithStatus(ctx: MutationCtx, toolId: Id<"tools">, status: "pending" | "approved") {
  return ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .collect();
}

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt !== undefined) throw new ConvexError("Tool not found.");
    authorize(canRemoveTool(viewer, tool));

    // Owners must settle live loans first. Admins can still remove an abusive listing;
    // its approved loans stay visible and can still be marked returned.
    const approved = await loansWithStatus(ctx, toolId, "approved");
    if (approved.length > 0 && viewer.role !== "admin") {
      throw new ConvexError("This tool has approved loans. Settle them before removing it.");
    }

    await ctx.db.patch(toolId, { removedAt: Date.now() });
    for (const loan of await loansWithStatus(ctx, toolId, "pending")) {
      await ctx.db.patch(loan._id, { status: "declined" });
      await enqueueNotification(ctx, { ...loan, status: "declined" }, tool);
    }
  },
});
