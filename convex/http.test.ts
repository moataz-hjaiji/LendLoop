import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SIGNATURE_HEADER, signPayload, TIMESTAMP_HEADER } from "./lib/hmac";
import { futureRange, newTool, setup, signIn, type TestDb } from "./test.utils";

const SECRET = "n8n-to-convex-test-secret";
const seconds = () => String(Math.floor(Date.now() / 1000));
const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let t: TestDb;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("N8N_TO_CONVEX_SECRET", SECRET);
  t = setup();
});
afterEach(() => vi.unstubAllEnvs());

async function signedPost(body: unknown, timestamp = seconds()) {
  const raw = JSON.stringify(body);
  return t.fetch("/n8n/activity", {
    method: "POST",
    headers: {
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: await signPayload(SECRET, timestamp, raw),
    },
    body: raw,
  });
}

/** An approved loan that ended two days ago, inserted directly as the UI cannot make one. */
async function overdueLoan() {
  const alice = await signIn(t, "alice smith");
  const bob = await signIn(t, "bob jones");
  const toolId = await alice.client.mutation(api.tools.create, newTool);
  const loanId: Id<"loans"> = await t.run((ctx) =>
    ctx.db.insert("loans", {
      toolId,
      ownerId: alice.userId,
      borrowerId: bob.userId,
      startDate: isoDay(-5),
      endDate: isoDay(-2),
      status: "approved",
    }),
  );
  return { loanId, alice, bob };
}

const events = () => t.run((ctx) => ctx.db.query("automationEvents").collect());

describe("signed endpoints reject bad requests", () => {
  test("no signature", async () => {
    expect((await t.fetch("/n8n/overdue-loans")).status).toBe(401);
  });

  test("wrong secret", async () => {
    const timestamp = seconds();
    const response = await t.fetch("/n8n/overdue-loans", {
      headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: await signPayload("wrong", timestamp, "") },
    });
    expect(response.status).toBe(401);
  });

  test("a captured request replayed after the window", async () => {
    const old = String(Math.floor(Date.now() / 1000) - 301);
    const response = await signedPost({ idempotencyKey: "error:1", kind: "workflow_error", status: "failed" }, old);
    expect(response.status).toBe(401);
    expect(await events()).toHaveLength(0);
  });

  test("a tampered body", async () => {
    const timestamp = seconds();
    const response = await t.fetch("/n8n/activity", {
      method: "POST",
      headers: {
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: await signPayload(SECRET, timestamp, '{"status":"failed"}'),
      },
      body: '{"status":"sent"}',
    });
    expect(response.status).toBe(401);
  });

  test("signed but invalid payloads get a 400 and write nothing", async () => {
    expect((await signedPost({ idempotencyKey: "bad key", kind: "reminder", status: "sent" })).status).toBe(400);
    expect((await signedPost({ idempotencyKey: "reminder:1", kind: "nope", status: "sent" })).status).toBe(400);
    expect((await signedPost({ idempotencyKey: "reminder:1", kind: "reminder", status: "sent", loanId: "nope" })).status).toBe(400);
    expect(await events()).toHaveLength(0);
  });
});

describe("overdue feed", () => {
  async function fetchOverdue() {
    const timestamp = seconds();
    const response = await t.fetch("/n8n/overdue-loans", {
      headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: await signPayload(SECRET, timestamp, "") },
    });
    expect(response.status).toBe(200);
    return (await response.json()).loans;
  }

  test("returns only the fields a reminder needs", async () => {
    const { loanId } = await overdueLoan();
    expect(await fetchOverdue()).toEqual([
      {
        idempotencyKey: `reminder:${loanId}:${isoDay(0)}`,
        loanId,
        toolName: newTool.name,
        dueDate: isoDay(-2),
        daysOverdue: 2,
        borrowerEmail: "bob@example.com",
        borrowerFirstName: "bob",
      },
    ]);
  });

  test("a loan already reminded today drops out", async () => {
    const { loanId } = await overdueLoan();
    const [loan] = await fetchOverdue();
    await signedPost({ idempotencyKey: loan.idempotencyKey, kind: "reminder", status: "sent", loanId });
    expect(await fetchOverdue()).toEqual([]);
  });

  test("a returned loan is no longer overdue", async () => {
    const { loanId, alice } = await overdueLoan();
    await alice.client.mutation(api.loans.markReturned, { loanId });
    expect(await fetchOverdue()).toEqual([]);
  });

  test("a failed reminder comes back so a later run can retry it", async () => {
    const { loanId } = await overdueLoan();
    const [loan] = await fetchOverdue();
    await signedPost({ idempotencyKey: loan.idempotencyKey, kind: "reminder", status: "failed", loanId });
    expect(await fetchOverdue()).toHaveLength(1);
  });
});

describe("idempotent write-back", () => {
  test("a retried claim loses, a retried result is ignored, and only one row exists", async () => {
    const { loanId, bob } = await overdueLoan();
    const write = (status: string) =>
      signedPost({ idempotencyKey: `reminder:${loanId}:2026-06-10`, kind: "reminder", status, loanId }).then((r) => r.json());

    expect(await write("sending")).toMatchObject({ applied: true });
    expect(await write("sending")).toMatchObject({ applied: false }); // a duplicate run must not send
    expect(await write("sent")).toMatchObject({ applied: true });
    expect(await write("sent")).toMatchObject({ applied: false });
    expect(await write("failed")).toMatchObject({ applied: false }); // "sent" is final

    expect(await events()).toHaveLength(1);
    const [row] = await bob.client.query(api.loans.myRequests, {});
    expect(row.activity).toMatchObject([{ kind: "reminder", status: "sent" }]);
  });
});

describe("outbound notifications", () => {
  test("a status change queues a ledger row and a minimal payload for the right person", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", "http://n8n.test/hook");
    vi.stubEnv("CONVEX_TO_N8N_SECRET", "out-secret");

    const alice = await signIn(t, "alice smith");
    const bob = await signIn(t, "bob jones");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    await bob.client.mutation(api.loans.request, { toolId, ...futureRange(1, 2) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://n8n.test/hook");
    const payload = JSON.parse(init.body as string);
    expect(Object.keys(payload).sort()).toEqual(
      ["endDate", "eventId", "loanId", "recipientEmail", "recipientFirstName", "startDate", "status", "toolName"].sort(),
    );
    expect(payload).toMatchObject({ status: "pending", recipientEmail: "alice@example.com", recipientFirstName: "alice" });

    const headers = init.headers as Record<string, string>;
    expect(headers[SIGNATURE_HEADER]).toBe(await signPayload("out-secret", headers[TIMESTAMP_HEADER], init.body as string));
    expect(await events()).toMatchObject([{ kind: "notification", status: "queued" }]);
    vi.unstubAllGlobals();
  });

  test("retries with backoff, then records a visible failure instead of failing silently", async () => {
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", "http://n8n.test/hook");
    vi.stubEnv("CONVEX_TO_N8N_SECRET", "out-secret");

    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    await bob.client.mutation(api.loans.request, { toolId, ...futureRange(1, 2) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(await events()).toMatchObject([
      { status: "failed", detail: expect.stringContaining("Gave up after 5 attempts") },
    ]);
    vi.unstubAllGlobals();
  });

  test("the failure of a webhook never affects the user's mutation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const alice = await signIn(t, "alice");
    const bob = await signIn(t, "bob");
    const toolId = await alice.client.mutation(api.tools.create, newTool);
    await expect(bob.client.mutation(api.loans.request, { toolId, ...futureRange(1, 2) })).resolves.toBeDefined();
    vi.unstubAllGlobals();
  });
});
