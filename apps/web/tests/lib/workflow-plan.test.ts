import { runPlanInputSchema } from "@otomat/domain";
import { encodeProfileChoice, encodeRuntimeChoice } from "@web/lib/agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";
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
  setWorkflowCompetitorExecution,
} from "@web/lib/workflow/competitors";
import { buildRunPlanInput } from "@web/lib/workflow/plan-input";
import {
  clearInheritedNodeOverrides,
  moveWorkflowStep,
  setWorkflowStepExecution,
  toggleWorkflowDependency,
} from "@web/lib/workflow/steps";
import { expect, it } from "vitest";

function competeGroupAt(steps: readonly WorkflowNodeDraft[], index: number): WorkflowCompeteDraft {
  const node = steps[index];
  if (node?.kind !== "compete") throw new Error(`expected a compete group at ${index}`);
  return node;
}

const pinned: ExecutionSelection = {
  agent: encodeRuntimeChoice("codex"),
  model: { kind: "model", id: "gpt-5.6-sol" },
  options: { reasoning_effort: { kind: "value", value: "ultra" } },
};

const inherits: ExecutionSelection = {
  agent: null,
  model: { kind: "model", id: "opus" },
  options: { effort: { kind: "value", value: "high" } },
};

it("builds a strict compete node with per-candidate ad-hoc runtimes and a profile", () => {
  const group = newWorkflowCompeteGroup(1);
  group.competitors[0] = {
    ...group.competitors[0]!,
    name: "Direct",
    context: { references: [{ kind: "file", path: "src/direct.ts" }], note: "Implement directly" },
    execution: { agent: encodeRuntimeChoice("codex"), options: {} },
  };
  group.competitors[1] = {
    ...group.competitors[1]!,
    name: "Layered",
    context: { references: [], note: "Implement with a boundary" },
    execution: { agent: encodeProfileChoice("profile-abc"), options: {} },
  };
  group.name = "Choose implementation";
  const dependent = {
    ...newWorkflowStep(2),
    name: "Verify",
    context: { references: [], note: "Run checks" },
  };
  const steps = toggleWorkflowDependency([group, dependent], 1, group.key);

  const plan = buildRunPlanInput(steps);

  expect(runPlanInputSchema.parse(plan)).toEqual(plan);
  expect(plan.steps[0]).toMatchObject({
    id: group.key,
    compete: [
      {
        name: "Direct",
        agent: "codex",
        note: "Implement directly",
        context: [{ kind: "file", path: "src/direct.ts" }],
      },
      {
        name: "Layered",
        agent: null,
        profile_id: "profile-abc",
        note: "Implement with a boundary",
      },
    ],
  });
  expect(plan.steps[1]?.depends_on).toEqual([group.key]);
});

it("drops what every inheriting node kept when the run's own configuration changes", () => {
  const step = { ...newWorkflowStep(1), execution: inherits };
  const own = { ...newWorkflowStep(2), execution: pinned };
  const group = newWorkflowCompeteGroup(3);
  group.competitors[0] = { ...group.competitors[0]!, execution: inherits };

  const cleared = clearInheritedNodeOverrides([step, own, group]);

  expect(cleared[0]?.kind === "step" && cleared[0].execution).toEqual({ agent: null, options: {} });
  expect(cleared[1]?.kind === "step" && cleared[1].execution).toEqual(pinned);
  expect(competeGroupAt(cleared, 2).competitors[0]?.execution).toEqual({
    agent: null,
    options: {},
  });
});

it("starts a candidate's model and options over when its agent changes, because another CLI announces other keys", () => {
  const group = newWorkflowCompeteGroup(1);
  group.competitors[0] = { ...group.competitors[0]!, execution: inherits };

  const changed = setWorkflowCompetitorExecution([group], 0, 0, {
    agent: encodeRuntimeChoice("codex"),
    options: {},
  });

  expect(competeGroupAt(changed, 0).competitors[0]?.execution).toEqual({
    agent: encodeRuntimeChoice("codex"),
    options: {},
  });
});

it("carries each node's option selections into the plan the daemon validates", () => {
  const inheriting = { ...newWorkflowStep(1), name: "First" };
  const named = {
    ...newWorkflowStep(2),
    name: "Second",
    execution: { agent: null, options: { effort: { kind: "value" as const, value: "high" } } },
  };
  const declined = { ...newWorkflowStep(3), name: "Third" };
  const steps = setWorkflowStepExecution([inheriting, named, declined], 2, {
    agent: null,
    options: { effort: { kind: "agent_default" } },
  });

  const plan = buildRunPlanInput(steps);

  expect(runPlanInputSchema.parse(plan)).toEqual(plan);
  expect(plan.steps.map((step) => ("options" in step ? step.options : null))).toEqual([
    null,
    { effort: { kind: "value", value: "high" } },
    { effort: { kind: "agent_default" } },
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
