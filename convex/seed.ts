import { internalMutation } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import type { Category, Condition } from "./lib/domain";

const DAY_MS = 86_400_000;
const daysFromToday = (days: number) => todayUtc(Date.now() + days * DAY_MS);

const USERS = {
  alice: { name: "Alice Martin", email: "alice@example.test" },
  bob: { name: "Bob Nguyen", email: "bob@example.test" },
  // @bounce.test makes the mock sender fail, to demo the failure path end to end.
  dana: { name: "Dana Bounce", email: "dana@bounce.test" },
};

const TOOLS: { owner: keyof typeof USERS; name: string; category: Category; condition: Condition; description: string }[] = [
  { owner: "alice", name: "Cordless drill", category: "power tools", condition: "good", description: "18V with two batteries and a bit set." },
  { owner: "alice", name: "Circular saw", category: "power tools", condition: "fair", description: "Works well. Blade is a little worn." },
  { owner: "alice", name: "Hedge trimmer", category: "garden", condition: "like new", description: "Electric, with a 10m extension lead." },
  { owner: "bob", name: "Lawn aerator", category: "garden", condition: "good", description: "Step-on spike aerator." },
  { owner: "bob", name: "Stand mixer", category: "kitchen", condition: "like new", description: "With dough hook and whisk." },
  { owner: "bob", name: "4-person tent", category: "camping", condition: "good", description: "Waterproof, sets up in ten minutes." },
];

/**
 * Demo data: npx convex run seed:run
 * Internal, so only someone with deployment access can run it. Seeded users have no
 * Clerk login; you sign in as yourself and see their data as an admin.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("tools").first()) return "Already has data, nothing to do.";

    const insertUser = (key: string, user: { name: string; email: string }) =>
      ctx.db.insert("users", { tokenIdentifier: `seed|${key}`, ...user, role: "user", trustedLender: key === "alice" });
    const ids = {
      alice: await insertUser("alice", USERS.alice),
      bob: await insertUser("bob", USERS.bob),
      dana: await insertUser("dana", USERS.dana),
    };

    const toolIds: Record<string, Awaited<ReturnType<typeof ctx.db.insert<"tools">>>> = {};
    for (const { owner, ...tool } of TOOLS) {
      toolIds[tool.name] = await ctx.db.insert("tools", { ...tool, ownerId: ids[owner] });
    }

    // Inserted directly: the app rightly refuses to create a loan with past dates.
    const overdue = (toolName: string, borrowerId: (typeof ids)["bob"], daysLate: number) =>
      ctx.db.insert("loans", {
        toolId: toolIds[toolName],
        ownerId: ids.alice,
        borrowerId,
        startDate: daysFromToday(-(daysLate + 5)),
        endDate: daysFromToday(-daysLate),
        status: "approved",
      });
    await overdue("Cordless drill", ids.bob, 3); // the reminder succeeds
    await overdue("Circular saw", ids.dana, 1); // the reminder fails, showing the error path

    return "Seeded 3 users, 6 tools and 2 overdue loans.";
  },
});
