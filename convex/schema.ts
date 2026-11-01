import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  eventKindValidator,
  eventStatusValidator,
  loanStatusValidator,
  roleValidator,
} from "./lib/domain";

export default defineSchema({
  users: defineTable({
    // From the verified Clerk JWT.
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    role: roleValidator,
    trustedLender: v.boolean(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    // Soft delete, so loan history keeps its tool.
    removedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_removed_category", ["removedAt", "category"]),

  // A request is a loan with status "pending".
  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"), // copied from the tool for the "incoming" index
    borrowerId: v.id("users"),
    // YYYY-MM-DD, so string comparison works for ranges.
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatusValidator,
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_status_endDate", ["status", "endDate"]),

  // Idempotency ledger for n8n, also shown as activity on each loan.
  automationEvents: defineTable({
    idempotencyKey: v.string(),
    kind: eventKindValidator,
    status: eventStatusValidator,
    loanId: v.optional(v.id("loans")),
    detail: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),
});
