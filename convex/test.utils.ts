/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

export function setup() {
  return convexTest(schema, modules);
}
export type TestDb = ReturnType<typeof setup>;

/** Creates a user through the real sign-in path, and returns a client acting as them. */
export async function signIn(t: TestDb, name: string, role: "user" | "admin" = "user") {
  const client = t.withIdentity({ name, email: `${name.split(" ")[0]}@example.com`, subject: name, issuer: "test" });
  const userId = await client.mutation(api.users.store, {});
  if (role === "admin") await t.run((ctx) => ctx.db.patch(userId, { role }));
  return { client, userId };
}

export const newTool = {
  name: "Cordless drill",
  category: "power tools",
  condition: "good",
  description: "18V with two batteries",
} as const;

export function futureRange(startInDays: number, endInDays: number) {
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return { startDate: day(startInDays), endDate: day(endInDays) };
}
