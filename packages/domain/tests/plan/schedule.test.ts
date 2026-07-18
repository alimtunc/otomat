import { describe, expect, it } from "vitest";

import type { RunPlan } from "#domain/contracts/entities";
import {
  allStepsSucceeded,
  hasActiveStep,
  InvalidRunPlanError,
  nextReadyStep,
  planExecutionOrder,
  planOutcome,
} from "#domain/plan/schedule";
import type { StepRunState } from "#domain/state-machines/step-run";

function plan(steps: Array<{ id: string; depends_on?: string[] }>): RunPlan {
  return {
    version: 1,
    steps: steps.map(({ id, depends_on = [] }) => ({
      id,
      name: `Step ${id}`,
      agent: null,
      prompt: `Do ${id}`,
      depends_on,
    })),
  };
}

function statuses(entries: Record<string, StepRunState>): Map<string, StepRunState> {
  return new Map(Object.entries(entries));
}

const diamond = plan([
  { id: "root" },
  { id: "left", depends_on: ["root"] },
  { id: "right", depends_on: ["root"] },
  { id: "merge", depends_on: ["left", "right"] },
]);

describe("planExecutionOrder", () => {
  it("orders dependencies first and breaks ties by plan position", () => {
    expect(planExecutionOrder(diamond).map((step) => step.id)).toEqual([
      "root",
      "left",
      "right",
      "merge",
    ]);
  });

  it("keeps plan position deterministic for independent steps", () => {
    const independent = plan([{ id: "b" }, { id: "a" }, { id: "c" }]);
    expect(planExecutionOrder(independent).map((step) => step.id)).toEqual(["b", "a", "c"]);
  });

  it("throws on a cyclic persisted plan", () => {
    const cyclic = plan([
      { id: "a", depends_on: ["b"] },
      { id: "b", depends_on: ["a"] },
    ]);
    expect(() => planExecutionOrder(cyclic)).toThrow(InvalidRunPlanError);
  });
});

describe("nextReadyStep", () => {
  it("starts with the first dependency-free step", () => {
    expect(nextReadyStep(diamond, statuses({}))?.id).toBe("root");
  });

  it("unblocks dependents only after every dependency succeeded", () => {
    expect(nextReadyStep(diamond, statuses({ root: "succeeded", left: "succeeded" }))?.id).toBe(
      "right",
    );
    expect(
      nextReadyStep(diamond, statuses({ root: "succeeded", left: "succeeded", right: "running" })),
    ).toBeNull();
  });

  it("never offers a step whose dependency halted", () => {
    expect(nextReadyStep(diamond, statuses({ root: "failed" }))).toBeNull();
  });
});

describe("planOutcome", () => {
  it("reports running while a step is active", () => {
    expect(planOutcome(diamond, statuses({ root: "running" }))).toBe("running");
    expect(hasActiveStep(diamond, statuses({ root: "running" }))).toBe(true);
  });

  it("reports running while a queued step is still ready", () => {
    expect(planOutcome(diamond, statuses({ root: "succeeded" }))).toBe("running");
  });

  it("reports succeeded only when every step succeeded", () => {
    const all = statuses({
      root: "succeeded",
      left: "succeeded",
      right: "succeeded",
      merge: "succeeded",
    });
    expect(planOutcome(diamond, all)).toBe("succeeded");
    expect(allStepsSucceeded(diamond, all)).toBe(true);
  });

  it("reports failed once a failure settles the plan, even with cancellations", () => {
    expect(
      planOutcome(diamond, statuses({ root: "succeeded", left: "failed", right: "canceled" })),
    ).toBe("failed");
  });

  it("treats stale as failed", () => {
    expect(planOutcome(diamond, statuses({ root: "stale" }))).toBe("failed");
  });

  it("reports canceled when steps were only canceled", () => {
    expect(planOutcome(diamond, statuses({ root: "canceled" }))).toBe("canceled");
  });
});
