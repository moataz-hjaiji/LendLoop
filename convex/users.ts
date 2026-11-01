import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, requireAdmin } from "./lib/auth";

/** Creates or refreshes the signed-in user's row. The client sends nothing but its JWT. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("You must be signed in.");

    const name = identity.name ?? identity.email ?? "Neighbor";
    const email = identity.email ?? "";
    const existing = await getCurrentUser(ctx);
    if (existing) {
      // Role and trust are never touched here: they only change through the admin paths.
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }
    return ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      role: "user",
      trustedLender: false,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    // For the UI only (which nav links to show). The server still checks every call.
    return { _id: user._id, name: user.name, role: user.role, trustedLender: user.trustedLender };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(200); // shortcut: first 200 only, paginate past a neighborhood
    return users.map(({ _id, name, email, role, trustedLender }) => ({
      _id,
      name,
      email,
      role,
      trustedLender,
    }));
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});

/**
 * Bootstraps the first admin. Internal, so browsers cannot call it; running it needs
 * deployment access: npx convex run users:promoteToAdmin '{"email":"you@example.com"}'
 */
export const promoteToAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new ConvexError(`No user with email ${email}. Sign in once first.`);
    await ctx.db.patch(user._id, { role: "admin" });
    return `${email} is now an admin.`;
  },
});
