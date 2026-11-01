import { v } from "convex/values";

export const CATEGORIES = [
  "power tools",
  "hand tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;
export const CONDITIONS = ["like new", "good", "fair", "worn"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];
export type LoanStatus = "pending" | "approved" | "declined" | "cancelled" | "returned";
export type EventStatus = "queued" | "sending" | "sent" | "failed";

export const roleValidator = v.union(v.literal("admin"), v.literal("user"));
export const categoryValidator = v.union(
  v.literal("power tools"),
  v.literal("hand tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("other"),
);
export const conditionValidator = v.union(
  v.literal("like new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
export const loanStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export const eventKindValidator = v.union(
  v.literal("notification"),
  v.literal("reminder"),
  v.literal("workflow_error"),
);
export const eventStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
);
