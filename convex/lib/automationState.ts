import type { EventStatus } from "./domain";

// Idempotency rule: only one caller can claim "sending", "sent" is final,
// and "failed" can be claimed again.
export function shouldApply(current: EventStatus | undefined, incoming: EventStatus): boolean {
  if (current === "sent") return false;
  if (incoming === "sending") return current !== "sending";
  if (incoming === "queued") return current === undefined;
  return current !== incoming;
}
