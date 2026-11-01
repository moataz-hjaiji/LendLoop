import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { futureRange, newTool, setup, signIn, type TestDb } from "./test.utils";

let t: TestDb;
beforeEach(() => {
  vi.useFakeTimers(); // keeps scheduled webhook deliveries from firing during these tests
  t = setup();
});

describe("public access", () => {
  test("anonymous callers get name and category only, with no owner data", async () => {
    const { client } = await signIn(t, "alice");
    await client.mutation(api.tools.create, newTool);

    const [row, ...rest] = await t.query(api.tools.listPublic, {});
    expect(rest).toHaveLength(0);
    expect(Object.keys(row).sort()).toEqual(["_id", "category", "name"]);
  });

  test("a tool out on loan is not listed publicly", async () => {
    const lender = await signIn(t, "alice");
    const borrower = await signIn(t, "bob");
    const toolId = await lender.client.mutation(api.tools.create, newTool);
    const loanId = await borrower.client.mutation(api.loans.request, { toolId, ...futureRange(0, 2) });
    await lender.client.mutation(api.loans.approve, { loanId });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
  });

  test("every other function refuses anonymous callers", async () => {
    await expect(t.query(api.tools.list, {})).rejects.toThrow("signed in");
    await expect(t.query(api.loans.myRequests, {})).rejects.toThrow("signed in");
    await expect(t.mutation(api.tools.create, newTool)).rejects.toThrow("signed in");
  });
});

describe("tool ownership", () => {
  test("users cannot edit or remove someone else's listing", async () => {
    const alice = await signIn(t, "alice");
    const mallory = await signIn(t, "mallory");
    const toolId = await alice.client.mutation(api.tools.create, newTool);

    await expect(mallory.client.mutation(api.tools.update, { toolId, ...newTool })).rejects.toThrow("not allowed");
    await expect(mallory.client.mutation(api.tools.remove, { toolId })).rejects.toThrow("not allowed");
  });

  test("an admin can remove any listing but cannot edit it", async () => {
    const alice = await signIn(t, "alice");
    const admin = await signIn(t, "root", "admin");
    const toolId = await alice.client.mutation(api.tools.create, newTool);

    await expect(admin.client.mutation(api.tools.update, { toolId, ...newTool })).rejects.toThrow("not allowed");
    await admin.client.mutation(api.tools.remove, { toolId });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
  });

  test("the owner cannot remove a tool with an approved loan", async () => {
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    const loanId = await bob.client.mutation(api.loans.request, { toolId, ...futureRange(1, 2) });
    await alice.client.mutation(api.loans.approve, { loanId });
    await expect(alice.client.mutation(api.tools.remove, { toolId })).rejects.toThrow("approved loans");
  });
});

describe("loan permissions", () => {
  async function pendingLoan() {
    const lender = await signIn(t, "alice");
    const borrower = await signIn(t, "bob");
    const stranger = await signIn(t, "mallory");
    const admin = await signIn(t, "root", "admin");
    const toolId = await lender.client.mutation(api.tools.create, newTool);
    const loanId = await borrower.client.mutation(api.loans.request, { toolId, ...futureRange(1, 3) });
    return { lender, borrower, stranger, admin, toolId, loanId };
  }

  test("only the lender can approve, decline or mark returned", async () => {
    const { lender, borrower, stranger, admin, loanId } = await pendingLoan();
    for (const actor of [borrower, stranger, admin]) {
      await expect(actor.client.mutation(api.loans.approve, { loanId })).rejects.toThrow("not allowed");
      await expect(actor.client.mutation(api.loans.decline, { loanId })).rejects.toThrow("not allowed");
    }
    await lender.client.mutation(api.loans.approve, { loanId });
    await expect(borrower.client.mutation(api.loans.markReturned, { loanId })).rejects.toThrow("not allowed");
    await lender.client.mutation(api.loans.markReturned, { loanId });
  });

  test("only the borrower can cancel", async () => {
    const { lender, borrower, loanId } = await pendingLoan();
    await expect(lender.client.mutation(api.loans.cancel, { loanId })).rejects.toThrow("not allowed");
    await borrower.client.mutation(api.loans.cancel, { loanId });
  });

  test("status can only move forward", async () => {
    const { lender, loanId } = await pendingLoan();
    await expect(lender.client.mutation(api.loans.markReturned, { loanId })).rejects.toThrow("cannot become");
    await lender.client.mutation(api.loans.decline, { loanId });
    await expect(lender.client.mutation(api.loans.approve, { loanId })).rejects.toThrow("cannot become");
  });

  test("you cannot borrow your own tool", async () => {
    const { lender, toolId } = await pendingLoan();
    await expect(lender.client.mutation(api.loans.request, { toolId, ...futureRange(5, 6) })).rejects.toThrow("your own");
  });

  test("only admins can see all loans and users, or grant Trusted Lender", async () => {
    const { lender, admin } = await pendingLoan();
    await expect(lender.client.query(api.loans.listAll, {})).rejects.toThrow("Admins only");
    await expect(lender.client.query(api.users.listAll, {})).rejects.toThrow("Admins only");
    await expect(lender.client.query(api.automation.recent, {})).rejects.toThrow("Admins only");
    await expect(
      lender.client.mutation(api.users.setTrustedLender, { userId: lender.userId, trusted: true }),
    ).rejects.toThrow("Admins only");

    expect(await admin.client.query(api.loans.listAll, {})).toHaveLength(1);
    await admin.client.mutation(api.users.setTrustedLender, { userId: lender.userId, trusted: true });
  });

  test("signing in again never changes a user's role", async () => {
    const admin = await signIn(t, "root", "admin");
    await admin.client.mutation(api.users.store, {});
    expect((await admin.client.query(api.users.me, {}))?.role).toBe("admin");
  });

  test("contact details are shared only with an approved loan", async () => {
    const { lender, borrower, loanId } = await pendingLoan();
    expect((await lender.client.query(api.loans.incoming, {}))[0].borrowerEmail).toBeUndefined();
    await lender.client.mutation(api.loans.approve, { loanId });
    expect((await lender.client.query(api.loans.incoming, {}))[0].borrowerEmail).toBe("bob@example.com");
    expect((await borrower.client.query(api.loans.myRequests, {}))[0].ownerEmail).toBe("alice@example.com");
  });
});

describe("overlap rules", () => {
  test("requests and approvals cannot overlap an approved loan", async () => {
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const carol = await signIn(t, "carol");
    const toolId = await alice.client.mutation(api.tools.create, newTool);

    const first = await bob.client.mutation(api.loans.request, { toolId, ...futureRange(1, 5) });
    const second = await carol.client.mutation(api.loans.request, { toolId, ...futureRange(5, 8) });
    await alice.client.mutation(api.loans.approve, { loanId: first });

    await expect(alice.client.mutation(api.loans.approve, { loanId: second })).rejects.toThrow("overlap");
    await expect(carol.client.mutation(api.loans.request, { toolId, ...futureRange(3, 4) })).rejects.toThrow("booked");
    await carol.client.mutation(api.loans.request, { toolId, ...futureRange(9, 10) }); // later dates are fine

    await alice.client.mutation(api.loans.markReturned, { loanId: first });
    await alice.client.mutation(api.loans.approve, { loanId: second }); // returned frees the dates
  });

  test("a request whose dates have passed cannot be approved", async () => {
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    const { startDate, endDate } = futureRange(-5, -3);
    const loanId = await t.run((ctx) =>
      ctx.db.insert("loans", { toolId, ownerId: alice.userId, borrowerId: bob.userId, startDate, endDate, status: "pending" }),
    );
    await expect(alice.client.mutation(api.loans.approve, { loanId })).rejects.toThrow("passed");
    await alice.client.mutation(api.loans.decline, { loanId }); // it can still be cleared away
  });

  test("a tool that is overdue and not returned cannot be booked for today", async () => {
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const carol = await signIn(t, "carol");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    const { startDate, endDate } = futureRange(-5, -1);
    const overdue = await t.run((ctx) =>
      ctx.db.insert("loans", { toolId, ownerId: alice.userId, borrowerId: bob.userId, startDate, endDate, status: "approved" }),
    );

    await expect(carol.client.mutation(api.loans.request, { toolId, ...futureRange(0, 1) })).rejects.toThrow("booked");
    const later = await carol.client.mutation(api.loans.request, { toolId, ...futureRange(1, 2) });
    await alice.client.mutation(api.loans.approve, { loanId: later });

    await alice.client.mutation(api.loans.markReturned, { loanId: overdue });
    await carol.client.mutation(api.loans.request, { toolId, ...futureRange(0, 0) }); // returned frees today
  });

  test("bad dates are rejected by the server", async () => {
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    await expect(bob.client.mutation(api.loans.request, { toolId, ...futureRange(-1, 2) })).rejects.toThrow("past");
    await expect(bob.client.mutation(api.loans.request, { toolId, ...futureRange(3, 2) })).rejects.toThrow("before");
    await expect(
      bob.client.mutation(api.loans.request, { toolId, startDate: "2099-02-31", endDate: "2099-03-01" }),
    ).rejects.toThrow("valid");
  });
});
