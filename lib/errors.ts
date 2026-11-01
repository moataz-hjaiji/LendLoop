import { ConvexError } from "convex/values";

/** ConvexError messages are written for users. Anything else stays generic. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Please try again.";
}
