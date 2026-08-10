import { runPlanInputSchema } from "@otomat/domain";
import { encodeProfileChoice, encodeRuntimeChoice } from "@web/lib/agent-choice";
import {
  newWorkflowCompeteGroup,
  newWorkflowStep,
  workflowExecutableCount,
  type WorkflowCompeteDraft,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";
import {
  addWorkflowCompetitor,
  removeWorkflowCompetitor,
  setWorkflowCompetitorAgent,
} from "@web/lib/workflow/competitors";
import { buildRunPlanInput } from "@web/lib/workflow/plan-input";
import {
  clearInheritedNodeOverrides,
  moveWorkflowStep,
  setWorkflowStepEffort,
  setWorkflowStepModel,
  toggleWorkflowDependency,
} from "@web/lib/workflow/steps";
import { expect, it } from "vitest";

function competeGroupAt(steps: readonly WorkflowNodeDraft[], index: number): WorkflowCompeteDraft {
  const node = steps[index];
  if (node?.kind !== "compete") throw new Error(`expected a compete group at ${index}`);
  return node;
}

it("builds a strict compete node with per-candidate ad-hoc runtimes and a profile", () => {
  const group = newWorkflowCompeteGroup(1);
  group.name = "Choose implementation";
  group.competitors[0] = {
    ...group.competitors[0]!,
    name: "Direct",
    prompt: "Implement directly",
    agent: encodeRuntimeChoice("codex"),
  };
  group.competitors[1] = {
    ...group.competitors[1]!,
    name: "Layered",
    prompt: "Implement with a boundary",
    agent: encodeProfileChoice("profile-abc"),
  };
  const dependent = { ...newWorkflowStep(2), name: "Verify", prompt: "Run checks" };
  const steps = toggleWorkflowDependency([group, dependent], 1, group.key);

  const plan = buildRunPlanInput(steps);

  expect(runPlanInputSchema.parse(plan)).toEqual(plan);
  expect(plan.steps[0]).toMatchObject({
    id: group.key,
    compete: [
      { name: "Direct", agent: "codex", prompt: "Implement directly" },
      {
        name: "Layered",
        agent: null,
        profile_id: "profile-abc",
        prompt: "Implement with a boundary",
      },
    ],
  });
  expect(plan.steps[1]?.depends_on).toEqual([group.key]);
});

it("drops the model and effort of every node that inherits the run agent when that agent changes", () => {
  const step = {
    ...newWorkflowStep(1),
    model: { kind: "model", id: "opus" } as const,
    effort: { kind: "level", value: "high" } as const,
  };
  const pinned = {
    ...newWorkflowStep(2),
    agent: encodeRuntimeChoice("codex"),
    model: { kind: "model", id: "gpt-5.6-sol" } as const,
    effort: { kind: "level", value: "ultra" } as const,
  };
  const group = newWorkflowCompeteGroup(3);
  group.competitors[0] = {
    ...group.competitors[0]!,
    model: { kind: "model", id: "opus" } as const,
    effort: { kind: "level", value: "max" } as const,
  };

  const cleared = clearInheritedNodeOverrides([step, pinned, group], "agent");

  expect(cleared[0]).toMatchObject({ model: undefined, effort: undefined });
  expect(cleared[1]).toMatchObject({ model: { id: "gpt-5.6-sol" }, effort: { value: "ultra" } });
  expect(competeGroupAt(cleared, 2).competitors[0]?.effort).toBeUndefined();
});

it("drops only the effort of nodes that follow the run model when that model changes", () => {
  const inheriting = { ...newWorkflowStep(1), effort: { kind: "level", value: "high" } as const };
  const ownModel = {
    ...newWorkflowStep(2),
    model: { kind: "model", id: "opus" } as const,
    effort: { kind: "level", value: "max" } as const,
  };

  const cleared = clearInheritedNodeOverrides([inheriting, ownModel], "model");

  expect(cleared[0]).toMatchObject({ effort: undefined });
  expect(cleared[1]).toMatchObject({ model: { id: "opus" }, effort: { value: "max" } });
});

it("clears a competitor's model and effort whenever its agent changes", () => {
  const group = newWorkflowCompeteGroup(1);
  group.competitors[0] = {
    ...group.competitors[0]!,
    model: { kind: "model", id: "opus" } as const,
    effort: { kind: "level", value: "high" } as const,
  };

  const changed = setWorkflowCompetitorAgent([group], 0, 0, encodeRuntimeChoice("codex"));

  expect(competeGroupAt(changed, 0).competitors[0]).toMatchObject({
    agent: encodeRuntimeChoice("codex"),
    model: undefined,
    effort: undefined,
  });
});

it("drops a step's level when its own model changes, because levels are published per model", () => {
  const step = { ...newWorkflowStep(1), effort: { kind: "level", value: "ultra" } as const };

  const changed = setWorkflowStepModel([step], 0, { kind: "model", id: "gpt-5.6-sol" });

  expect(changed[0]).toMatchObject({ model: { id: "gpt-5.6-sol" }, effort: undefined });
});

it("carries each node's effort selection into the plan the daemon validates", () => {
  const inheriting = { ...newWorkflowStep(1), name: "First", prompt: "go" };
  const pinned = {
    ...newWorkflowStep(2),
    name: "Second",
    prompt: "go",
    effort: { kind: "level", value: "high" } as const,
  };
  const own = { ...newWorkflowStep(3), name: "Third", prompt: "go" };
  const steps = setWorkflowStepEffort([inheriting, pinned, own], 2, { kind: "agent_default" });

  const plan = buildRunPlanInput(steps);

  expect(runPlanInputSchema.parse(plan)).toEqual(plan);
  expect(plan.steps.map((step) => ("effort" in step ? step.effort : null))).toEqual([
    undefined,
    { kind: "level", value: "high" },
    { kind: "agent_default" },
  ]);
});

it("keeps compete groups valid and dependencies top-level while editing", () => {
  const group = newWorkflowCompeteGroup(1);
  const dependent = newWorkflowStep(2);
  let steps = toggleWorkflowDependency([group, dependent], 1, group.key);
  steps = removeWorkflowCompetitor(steps, 0, 0);
  expect(competeGroupAt(steps, 0).competitors).toHaveLength(2);
  steps = addWorkflowCompetitor(steps, 0);
  expect(workflowExecutableCount(steps)).toBe(4);
  steps = removeWorkflowCompetitor(steps, 0, 1);
  steps = addWorkflowCompetitor(steps, 0);
  expect(
    new Set(competeGroupAt(steps, 0).competitors.map((competitor) => competitor.key)).size,
  ).toBe(3);

  const moved = moveWorkflowStep(steps, 1, -1);
  expect(moved[0]?.dependsOn).toEqual([]);
  expect(moved[1]?.dependsOn).toEqual([]);
});
