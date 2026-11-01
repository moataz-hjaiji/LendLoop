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
    // Clerk's stable identity (issuer + subject), taken only from the verified JWT.
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
    // Soft delete: loan history must keep pointing at a real tool.
    removedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_removed_category", ["removedAt", "category"]),

  // A loan starts life as a request (status "pending"), so there is one row and
  // one lifecycle rather than two tables to keep in sync.
  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"), // denormalized from the tool for the "incoming" index
    borrowerId: v.id("users"),
    // YYYY-MM-DD: a due date is a calendar day, not an instant. These sort
    // lexicographically, so range checks are plain string comparisons.
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatusValidator,
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_status_endDate", ["status", "endDate"]),

  // Idempotency ledger for everything n8n does, and the source of the
  // "Reminder sent 2 days ago" activity shown on each loan.
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
