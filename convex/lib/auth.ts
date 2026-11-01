import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Every public function starts here. Identity comes only from the verified Clerk
 * JWT on ctx.auth; no function accepts a userId argument from the client.
 */
export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new ConvexError("You must be signed in.");
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new ConvexError("Admins only.");
  return user;
}

// Pure policy rules: no database access, so they can be unit tested exhaustively.
type Actor = Pick<Doc<"users">, "_id" | "role">;
type OwnedTool = Pick<Doc<"tools">, "ownerId">;
type LoanParties = Pick<Doc<"loans">, "ownerId" | "borrowerId">;

export const canEditTool = (actor: Actor, tool: OwnedTool) => tool.ownerId === actor._id;

export const canRemoveTool = (actor: Actor, tool: OwnedTool) =>
  tool.ownerId === actor._id || actor.role === "admin";

// Admins moderate; they do not act on other people's loans. Only the lender decides
// and confirms a return, because they are the one who gets the tool back.
export const canDecideLoan = (actor: Actor, loan: LoanParties) => loan.ownerId === actor._id;

export const canCancelLoan = (actor: Actor, loan: LoanParties) => loan.borrowerId === actor._id;

export function authorize(allowed: boolean): void {
  if (!allowed) throw new ConvexError("You are not allowed to do that.");
}
