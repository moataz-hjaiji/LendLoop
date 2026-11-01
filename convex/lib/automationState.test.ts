import { expect, test } from "vitest";
import { shouldApply } from "./automationState";

test.each([
  [undefined, "sending", true],
  ["queued", "sending", true],
  ["failed", "sending", true], // a later run may try again
  ["sending", "sending", false], // only one caller wins the claim
  ["sent", "sending", false],
  ["sending", "sent", true],
  ["sent", "sent", false], // a retried write-back changes nothing
  ["sent", "failed", false], // "sent" is final
  ["sending", "failed", true],
  ["failed", "failed", false],
  [undefined, "queued", true],
  ["sent", "queued", false],
  ["queued", "queued", false],
] as const)("from %s to %s: %s", (current, incoming, expected) => {
  expect(shouldApply(current, incoming)).toBe(expected);
});
