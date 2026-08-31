import { expect, it } from "vitest";

import { STATUS_REGISTRY } from "#ui/lib/status/registry";

const MOTION_STATES = [
  ["issue", "running"],
  ["run", "preparing"],
  ["run", "running"],
  ["runContribution", "sending"],
  ["step", "starting"],
  ["step", "running"],
  ["compete", "running"],
  ["compete", "promoting"],
  ["operation", "running"],
  ["reviewCommentPublication", "pending"],
] as const;

it("maps every machine-in-motion state to the live tone", () => {
  for (const [kind, state] of MOTION_STATES) {
    expect({ kind, state, tone: STATUS_REGISTRY[kind][state].tone }).toEqual({
      kind,
      state,
      tone: "live",
    });
  }
});

it("never renders an animated state in the iris action tone", () => {
  for (const [kind, map] of Object.entries(STATUS_REGISTRY)) {
    for (const [state, descriptor] of Object.entries(map)) {
      if (descriptor.live === true) {
        expect({ kind, state, tone: descriptor.tone }).not.toEqual({ kind, state, tone: "iris" });
      }
    }
  }
});

it("keeps iris for actionable states rather than motion", () => {
  expect(STATUS_REGISTRY.issue.ready.tone).toBe("iris");
  expect(STATUS_REGISTRY.review.open.tone).toBe("iris");
});
