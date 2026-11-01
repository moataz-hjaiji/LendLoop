import { describe, expect, test } from "vitest";
import { assertValidRange, daysBetween, isValidDate, rangesOverlap } from "./dates";

const today = "2026-06-10";

describe("date rules", () => {
  test("rejects impossible dates that Date would roll over", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("10/06/2026")).toBe(false);
  });

  test("validates ranges", () => {
    expect(() => assertValidRange("2026-06-10", "2026-06-10", today)).not.toThrow();
    expect(() => assertValidRange("2026-06-09", "2026-06-12", today)).toThrow();
    expect(() => assertValidRange("2026-06-12", "2026-06-11", today)).toThrow();
    expect(() => assertValidRange("2026-06-10", "2026-12-31", today)).toThrow();
  });

  test("overlap treats both ends as inclusive", () => {
    const range = { startDate: "2026-06-10", endDate: "2026-06-15" };
    expect(rangesOverlap(range, { startDate: "2026-06-15", endDate: "2026-06-20" })).toBe(true);
    expect(rangesOverlap(range, { startDate: "2026-06-16", endDate: "2026-06-20" })).toBe(false);
    expect(rangesOverlap(range, { startDate: "2026-06-01", endDate: "2026-06-30" })).toBe(true);
  });

  test("counts days across a month boundary", () => {
    expect(daysBetween("2026-05-30", "2026-06-02")).toBe(3);
  });
});
