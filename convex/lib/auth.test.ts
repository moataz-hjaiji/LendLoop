import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { canCancelLoan, canDecideLoan, canEditTool, canRemoveTool } from "./auth";

const id = (value: string) => value as Id<"users">;
const owner = { _id: id("owner"), role: "user" } as const;
const borrower = { _id: id("borrower"), role: "user" } as const;
const stranger = { _id: id("stranger"), role: "user" } as const;
const admin = { _id: id("admin"), role: "admin" } as const;
const tool = { ownerId: owner._id };
const loan = { ownerId: owner._id, borrowerId: borrower._id };

describe("RBAC policy", () => {
  test("only the owner can edit a tool, not even an admin", () => {
    expect(canEditTool(owner, tool)).toBe(true);
    expect(canEditTool(stranger, tool)).toBe(false);
    expect(canEditTool(admin, tool)).toBe(false);
  });

  test("the owner or an admin can remove a tool", () => {
    expect(canRemoveTool(owner, tool)).toBe(true);
    expect(canRemoveTool(admin, tool)).toBe(true);
    expect(canRemoveTool(stranger, tool)).toBe(false);
  });

  test("only the lender decides a loan or confirms its return", () => {
    expect(canDecideLoan(owner, loan)).toBe(true);
    expect(canDecideLoan(borrower, loan)).toBe(false);
    expect(canDecideLoan(stranger, loan)).toBe(false);
    expect(canDecideLoan(admin, loan)).toBe(false);
  });

  test("only the borrower can cancel their request", () => {
    expect(canCancelLoan(borrower, loan)).toBe(true);
    expect(canCancelLoan(owner, loan)).toBe(false);
    expect(canCancelLoan(admin, loan)).toBe(false);
  });
});
