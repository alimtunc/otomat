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
  buildRunPlanInput,
  clearInheritedNodeModels,
  moveWorkflowStep,
  removeWorkflowCompetitor,
  setWorkflowCompetitorAgent,
  toggleWorkflowDependency,
} from "@web/lib/workflow-plan";
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

it("drops the model of every node that inherits the run agent when that agent changes", () => {
  const step = { ...newWorkflowStep(1), model: { kind: "model", id: "opus" } as const };
  const pinned = {
    ...newWorkflowStep(2),
    agent: encodeRuntimeChoice("codex"),
    model: { kind: "model", id: "gpt-5.6-sol" } as const,
  };
  const group = newWorkflowCompeteGroup(3);
  group.competitors[0] = {
    ...group.competitors[0]!,
    model: { kind: "model", id: "opus" } as const,
  };

  const cleared = clearInheritedNodeModels([step, pinned, group]);

  expect(cleared[0]).toMatchObject({ model: undefined });
  expect(cleared[1]).toMatchObject({ model: { id: "gpt-5.6-sol" } });
  expect(competeGroupAt(cleared, 2).competitors[0]?.model).toBeUndefined();
});

it("clears a competitor's model whenever its agent changes", () => {
  const group = newWorkflowCompeteGroup(1);
  group.competitors[0] = {
    ...group.competitors[0]!,
    model: { kind: "model", id: "opus" } as const,
  };

  const changed = setWorkflowCompetitorAgent([group], 0, 0, encodeRuntimeChoice("codex"));

  expect(competeGroupAt(changed, 0).competitors[0]).toMatchObject({
    agent: encodeRuntimeChoice("codex"),
    model: undefined,
  });
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
