import type { EventStatus } from "./domain";

/**
 * The idempotency rule for automation events, given the state stored for a key.
 *
 * - "sending" is a claim: only one caller can win it, and a retry that lost gets
 *   applied=false and must not send. This is what prevents duplicate reminders.
 * - "sent" is final: a retried write-back can never undo or repeat it.
 * - "failed" can be re-claimed, so a later run can try again.
 */
export function shouldApply(current: EventStatus | undefined, incoming: EventStatus): boolean {
  if (current === "sent") return false;
  if (incoming === "sending") return current !== "sending";
  if (incoming === "queued") return current === undefined;
  return current !== incoming;
}
