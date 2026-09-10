import { stepGuardReading } from "@web/lib/run/step-guard";
import { describe, expect, it } from "vitest";

import { envelope } from "#support/envelope";

const blocked = envelope({
  id: "e1",
  seq: 1,
  step_run_id: "s1",
  type: "run.delivery_blocked",
  payload: { reason: "left the workspace unchanged" },
});

function supervision(seq: number, entry: Record<string, unknown>) {
  return envelope({
    id: `e${seq}`,
    seq,
    step_run_id: "s1",
    type: "run.supervision_decision",
    payload: entry,
  });
}

describe("stepGuardReading", () => {
  it("reads nothing for a step the journal never held", () => {
    expect(stepGuardReading([blocked], "s2")).toBeNull();
  });

  it("holds a step on the delivery guard's own reason", () => {
    expect(stepGuardReading([blocked], "s1")).toEqual({
      reason: "left the workspace unchanged",
      blocking: true,
    });
  });

  it("holds a step while its supervisor is pending, and releases it on pass", () => {
    const pending = [supervision(1, { state: "pending" })];
    expect(stepGuardReading(pending, "s1")).toEqual({
      reason: "Delivered — waiting for this run's supervisor to judge it.",
      blocking: true,
    });

    const passed = [
      ...pending,
      supervision(2, {
        state: "decided",
        round: 1,
        decision: { decision: "pass", reason: "landed" },
      }),
    ];
    expect(stepGuardReading(passed, "s1")).toEqual({
      reason: "Supervisor passed it: landed",
      blocking: false,
    });
  });

  it("keeps holding on needs_changes and on a supervisor that could not decide", () => {
    const changes = supervision(1, {
      state: "decided",
      round: 1,
      decision: { decision: "needs_changes", reason: "thin", instructions: "do it" },
    });
    expect(stepGuardReading([changes], "s1")).toEqual({
      reason: "Supervisor asked for changes: thin",
      blocking: true,
    });

    const stopped = supervision(2, { state: "unavailable", reason: "budget spent" });
    expect(stepGuardReading([changes, stopped], "s1")).toEqual({
      reason: "Supervision stopped: budget spent",
      blocking: true,
    });
  });

  it("lets an operator override end the hold", () => {
    const events = [
      blocked,
      envelope({ id: "e2", seq: 2, step_run_id: "s1", type: "run.guard_override", payload: {} }),
    ];
    expect(stepGuardReading(events, "s1")).toEqual({
      reason: "You accepted this step despite the guard.",
      blocking: false,
    });
  });
});
