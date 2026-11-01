import { ConvexError } from "convex/values";

export const MAX_LOAN_DAYS = 90;
const DAY_MS = 86_400_000;

// UTC, so overdue flips at UTC midnight. A per-neighborhood timezone would fix that.
export const todayUtc = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // The round trip rejects dates that Date would silently roll over, like 2026-02-31.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export function assertValidRange(startDate: string, endDate: string, today: string): void {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new ConvexError("Dates must be valid and in YYYY-MM-DD format.");
  }
  if (startDate < today) throw new ConvexError("The start date cannot be in the past.");
  if (endDate < startDate) throw new ConvexError("The end date cannot be before the start date.");
  if (daysBetween(startDate, endDate) >= MAX_LOAN_DAYS) {
    throw new ConvexError(`A loan can last at most ${MAX_LOAN_DAYS} days.`);
  }
}

type Range = { startDate: string; endDate: string };

// Both ends are inclusive: a tool due back on the 5th cannot go out again on the 5th.
export const rangesOverlap = (a: Range, b: Range) =>
  a.startDate <= b.endDate && b.startDate <= a.endDate;
