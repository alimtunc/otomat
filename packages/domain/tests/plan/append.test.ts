import { describe, expect, it } from "vitest";

import type { RunPlan, RunPlanStep } from "#domain/contracts/run-plan";
import { appendPlanStep, waitablePlanNodes } from "#domain/plan/append";
import { RUN_PLAN_MAX_STEPS } from "#domain/plan/limits";
import type { StepRunState } from "#domain/state-machines/step-run";

function step(id: string, dependsOn: string[] = []): RunPlanStep {
  return { id, name: `Step ${id}`, agent: "fake", prompt: `do ${id}`, depends_on: dependsOn };
}

const LAUNCHED: RunPlan = { version: 1, steps: [step("a"), step("b", ["a"])] };

it("adds the node at the end and leaves every launched node byte-identical", () => {
  const revised = appendPlanStep(LAUNCHED, step("c", ["b"]));

  expect(revised.steps).toHaveLength(3);
  expect(revised.steps.slice(0, 2)).toEqual(LAUNCHED.steps);
  expect(revised.steps[2]).toEqual(step("c", ["b"]));
});

it("never mutates the plan it revises", () => {
  appendPlanStep(LAUNCHED, step("c"));

  expect(LAUNCHED.steps.map((node) => node.id)).toEqual(["a", "b"]);
});

it("refuses a dependency the plan does not already hold", () => {
  expect(() => appendPlanStep(LAUNCHED, step("c", ["ghost"]))).toThrow(/Unknown dependency/);
});

it("cannot close a cycle: the appended node may only wait on nodes that precede it, never on itself", () => {
  expect(() => appendPlanStep(LAUNCHED, step("c", ["c"]))).toThrow(/Unknown dependency/);
  expect(() => appendPlanStep(LAUNCHED, step("c", ["b", "a"]))).not.toThrow();
});

it("carries the parallel choice, and refuses it alongside a dependency", () => {
  const parallel = { ...step("c"), parallel: true };

  expect(appendPlanStep(LAUNCHED, parallel).steps[2]).toEqual(parallel);
  expect(() => appendPlanStep(LAUNCHED, { ...step("c", ["b"]), parallel: true })).toThrow(
    /waits on nothing/,
  );
});

it("carries the recovery link to the step it replaces", () => {
  const recovery = { ...step("c"), replaces: "a" };

  expect(appendPlanStep(LAUNCHED, recovery).steps[2]).toEqual(recovery);
});

it("refuses a replaced step the plan does not already hold", () => {
  expect(() => appendPlanStep(LAUNCHED, { ...step("c"), replaces: "ghost" })).toThrow(
    /Unknown replaced step/,
  );
});

it("refuses a node id that would shadow a launched one", () => {
  expect(() => appendPlanStep(LAUNCHED, step("b"))).toThrow(/already holds a node/);
});

it("refuses to grow a plan past the executable-step limit", () => {
  const full: RunPlan = {
    version: 1,
    steps: Array.from({ length: RUN_PLAN_MAX_STEPS }, (_unused, index) => step(`s${index}`)),
  };

  expect(() => appendPlanStep(full, step("extra"))).toThrow(/at most/);
});

it("counts compete candidates against the limit, not their group", () => {
  const group = {
    id: "g",
    name: "Choose",
    depends_on: [],
    compete: Array.from({ length: RUN_PLAN_MAX_STEPS }, (_unused, index) => ({
      id: `c${index}`,
      name: `Candidate ${index}`,
      agent: "fake",
      prompt: "try it",
    })),
  };

  expect(() => appendPlanStep({ version: 1, steps: [group] }, step("extra"))).toThrow(/at most/);
});

describe("waitablePlanNodes", () => {
  const chain: RunPlan = { version: 1, steps: [step("a"), step("b", ["a"]), step("c", ["b"])] };
  const waitable = (entries: Record<string, StepRunState>) =>
    waitablePlanNodes(chain, new Map(Object.entries(entries)), new Map()).map(
      ({ node, succeeded }) => [node.id, succeeded],
    );

  it("offers every node still worth waiting on, flagging the ones that already delivered", () => {
    expect(waitable({ a: "succeeded", b: "running" })).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });

  it("never offers a halted node or one nothing will start: waiting on them would hold the step forever", () => {
    expect(waitable({ a: "succeeded", b: "failed" }).map(([id]) => id)).toEqual(["a", "c"]);
    expect(waitable({ a: "succeeded", b: "withdrawn" }).map(([id]) => id)).toEqual(["a"]);
  });

  it("drops a compete group its competition halted", () => {
    const group = { id: "g", name: "Choose", depends_on: ["a"], compete: [step("x"), step("y")] };
    const plan: RunPlan = { version: 1, steps: [step("a"), group, step("d", ["g"])] };
    const nodes = waitablePlanNodes(
      plan,
      new Map([["a", "succeeded"]]),
      new Map([["g", "failed"]]),
    );
    expect(nodes.map(({ node }) => node.id)).toEqual(["a", "d"]);
  });
});
