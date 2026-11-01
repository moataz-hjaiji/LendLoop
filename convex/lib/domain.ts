import { v, type Infer } from "convex/values";

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

export type Category = Infer<typeof categoryValidator>;
export type Condition = Infer<typeof conditionValidator>;
export type LoanStatus = Infer<typeof loanStatusValidator>;
export type EventStatus = Infer<typeof eventStatusValidator>;

// Typed against the validators, so an option the server would reject does not compile.
export const CATEGORIES: readonly Category[] = [
  "power tools",
  "hand tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
];
export const CONDITIONS: readonly Condition[] = ["like new", "good", "fair", "worn"];
