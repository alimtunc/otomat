import { describe, expect, it } from "vitest";

import type { RunPlan } from "#domain/contracts/run-plan";
import { InvalidRunPlanError, planExecutionOrder } from "#domain/plan/execution-order";
import {
  allStepsSucceeded,
  blockingPlanDependencies,
  effectiveStepStatuses,
  haltedPlanOutcome,
  hasActiveStep,
  isStepActive,
  planOutcome,
  readyPlanWork,
} from "#domain/plan/schedule";
import type { StepRunState } from "#domain/state-machines/step-run";

function plan(steps: Array<{ id: string; depends_on?: string[]; replaces?: string }>): RunPlan {
  return {
    version: 1,
    steps: steps.map(({ id, depends_on = [], replaces }) => ({
      id,
      name: `Step ${id}`,
      agent: null,
      prompt: `Do ${id}`,
      depends_on,
      replaces: replaces ?? null,
    })),
  };
}

function statuses(entries: Record<string, StepRunState>): Map<string, StepRunState> {
  return new Map(Object.entries(entries));
}

function readyStep(target: RunPlan, entries: Record<string, StepRunState>) {
  const ready = readyPlanWork(target, statuses(entries), new Map());
  return ready?.kind === "step" ? ready.step : null;
}

const diamond = plan([
  { id: "root" },
  { id: "left", depends_on: ["root"] },
  { id: "right", depends_on: ["root"] },
  { id: "merge", depends_on: ["left", "right"] },
]);

const competePlan: RunPlan = {
  version: 1,
  steps: [
    {
      id: "plan",
      name: "Plan",
      agent: "claude",
      prompt: "Plan it",
      depends_on: [],
    },
    {
      id: "implementation",
      name: "Implementation",
      depends_on: ["plan"],
      compete: [
        { id: "candidate-a", name: "A", agent: "claude", prompt: "Build it" },
        { id: "candidate-b", name: "B", agent: "codex", prompt: "Build it" },
      ],
    },
    {
      id: "verify",
      name: "Verify",
      agent: "codex",
      prompt: "Verify it",
      depends_on: ["implementation"],
    },
  ],
};

describe("blockingPlanDependencies", () => {
  it("names the unfinished nodes a queued step waits on, in plan order", () => {
    const blockers = blockingPlanDependencies(
      diamond,
      statuses({ root: "succeeded", left: "awaiting_human", right: "succeeded" }),
      new Map(),
    );

    expect(blockers.map((node) => node.id)).toEqual(["left"]);
  });

  it("is empty once every dependency has succeeded", () => {
    const blockers = blockingPlanDependencies(
      diamond,
      statuses({ root: "succeeded", left: "succeeded", right: "succeeded" }),
      new Map(),
    );

    expect(blockers).toEqual([]);
  });

  it("counts an unselected compete group as the blocker of the step behind it", () => {
    const blockers = blockingPlanDependencies(
      competePlan,
      statuses({ plan: "succeeded", "candidate-a": "succeeded", "candidate-b": "succeeded" }),
      new Map([["implementation", "awaiting_selection" as const]]),
    );

    expect(blockers.map((node) => node.id)).toEqual(["implementation"]);
  });
});

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

describe("readyPlanWork over plain steps", () => {
  it("starts with the first dependency-free step", () => {
    expect(readyStep(diamond, {})?.id).toBe("root");
  });

  it("unblocks dependents only after every dependency succeeded", () => {
    expect(readyStep(diamond, { root: "succeeded", left: "succeeded" })?.id).toBe("right");
    expect(
      readyStep(diamond, { root: "succeeded", left: "succeeded", right: "running" }),
    ).toBeNull();
  });

  it("never offers a step whose dependency halted", () => {
    expect(readyStep(diamond, { root: "failed" })).toBeNull();
  });
});

describe("readyPlanWork", () => {
  it("offers all queued competitors together after group dependencies succeed", () => {
    const ready = readyPlanWork(
      competePlan,
      statuses({ plan: "succeeded" }),
      new Map([["implementation", "queued"]]),
    );

    expect(ready).toMatchObject({
      kind: "compete",
      group: { id: "implementation" },
      competitors: [{ id: "candidate-a" }, { id: "candidate-b" }],
    });
  });

  it("blocks dependents until the group has a selected winner", () => {
    const candidateStatuses = statuses({
      plan: "succeeded",
      "candidate-a": "succeeded",
      "candidate-b": "succeeded",
    });

    expect(
      readyPlanWork(
        competePlan,
        candidateStatuses,
        new Map([["implementation", "awaiting_selection"]]),
      ),
    ).toBeNull();
    expect(
      readyPlanWork(competePlan, candidateStatuses, new Map([["implementation", "selected"]])),
    ).toMatchObject({ kind: "step", step: { id: "verify" } });
  });

  it("offers only queued competitors when an interrupted group resumes", () => {
    const ready = readyPlanWork(
      competePlan,
      statuses({
        plan: "succeeded",
        "candidate-a": "succeeded",
        "candidate-b": "queued",
      }),
      new Map([["implementation", "running"]]),
    );

    expect(ready).toMatchObject({
      kind: "compete",
      competitors: [{ id: "candidate-b" }],
    });
  });
});

describe("a step waiting on a provider quota", () => {
  it("is active work the plan still owes, never a halted one", () => {
    const waiting = statuses({ root: "waiting_for_provider" });
    expect(isStepActive("waiting_for_provider")).toBe(true);
    expect(hasActiveStep(diamond, waiting)).toBe(true);
    expect(planOutcome(diamond, waiting)).toBe("running");
  });

  it("is not startable work, so nothing restarts it behind the scheduler", () => {
    expect(
      readyPlanWork(diamond, statuses({ root: "waiting_for_provider" }), new Map()),
    ).toBeNull();
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

  it("stops standing on a failure a linked recovery step already answered", () => {
    const recovered = plan([{ id: "implement" }, { id: "retry", replaces: "implement" }]);
    const halted = statuses({ implement: "stale", retry: "succeeded" });

    expect(effectiveStepStatuses(recovered, halted).get("implement")).toBe("succeeded");
    expect(haltedPlanOutcome(recovered, halted)).toBeNull();
    expect(allStepsSucceeded(recovered, halted)).toBe(true);
    expect(planOutcome(recovered, halted)).toBe("succeeded");
  });

  it("keeps standing on a failure an unlinked step merely succeeded next to", () => {
    const unlinked = plan([{ id: "implement" }, { id: "review" }]);
    const halted = statuses({ implement: "stale", review: "succeeded" });

    expect(haltedPlanOutcome(unlinked, halted)).toBe("failed");
    expect(planOutcome(unlinked, halted)).toBe("failed");
  });

  it("keeps standing on a failure whose recovery has not succeeded yet", () => {
    const recovered = plan([{ id: "implement" }, { id: "retry", replaces: "implement" }]);

    expect(planOutcome(recovered, statuses({ implement: "stale", retry: "failed" }))).toBe(
      "failed",
    );
    expect(planOutcome(recovered, statuses({ implement: "stale", retry: "running" }))).toBe(
      "running",
    );
  });

  it("unblocks the steps that waited on a recovered failure", () => {
    const recovered = plan([
      { id: "implement" },
      { id: "verify", depends_on: ["implement"] },
      { id: "retry", replaces: "implement" },
    ]);
    const halted = statuses({ implement: "stale", verify: "queued", retry: "succeeded" });

    expect(readyStep(recovered, Object.fromEntries(halted))?.id).toBe("verify");
    expect(blockingPlanDependencies(recovered, halted, new Map())).toEqual([]);
  });

  it("reports canceled when the plan only ever cancelled work", () => {
    expect(haltedPlanOutcome(diamond, statuses({ root: "canceled" }))).toBe("canceled");
    expect(haltedPlanOutcome(diamond, statuses({ root: "succeeded" }))).toBeNull();
  });

  it("keeps a compete plan running until a winner is selected", () => {
    const candidateStatuses = statuses({
      plan: "succeeded",
      "candidate-a": "succeeded",
      "candidate-b": "succeeded",
    });
    expect(
      planOutcome(
        competePlan,
        candidateStatuses,
        new Map([["implementation", "awaiting_selection"]]),
      ),
    ).toBe("running");
  });
});
