import {
  runPlanInputSchema,
  workflowPresetPlanSchema,
  type WorkflowPresetContract,
} from "@otomat/domain";
import { encodeProfileChoice, encodeRuntimeChoice } from "@web/lib/agent-choice";
import {
  freeNodeCounter,
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";
import { buildRunPlanInput } from "@web/lib/workflow/plan-input";
import {
  draftsFromPresetPlan,
  presetBlockedReason,
  presetPlanFromDrafts,
} from "@web/lib/workflow/preset";
import { expect, it } from "vitest";

function composed(): WorkflowNodeDraft[] {
  const [implement, review] = [newWorkflowStep(1), newWorkflowStep(2)];
  return [
    {
      ...implement,
      name: "Implement",
      execution: { agent: encodeProfileChoice("profile-1"), options: {} },
      context: {
        references: [{ kind: "file", path: "src/parser.ts" }],
        note: "keep it small",
      },
    },
    {
      ...review,
      name: "Review",
      dependsOn: [implement.key],
      execution: {
        agent: encodeRuntimeChoice("codex"),
        model: { kind: "model", id: "gpt-5.6" },
        options: { reasoning_effort: { kind: "value", value: "high" } },
      },
    },
  ];
}

function preset(overrides: Partial<WorkflowPresetContract> = {}): WorkflowPresetContract {
  return {
    id: "preset-1",
    name: "Ship",
    scope: "global",
    project_id: null,
    plan: { version: 1, steps: [] },
    compatibility: { launchable: true, issues: [] },
    ...overrides,
  };
}

it("saves the structure, the agents and the note, and never the attached context", () => {
  const plan = presetPlanFromDrafts(composed());

  expect(workflowPresetPlanSchema.safeParse(plan).success).toBe(true);
  expect(plan.steps).toEqual([
    {
      id: "step-1",
      name: "Implement",
      agent: null,
      profile_id: "profile-1",
      note: "keep it small",
      depends_on: [],
    },
    {
      id: "step-2",
      name: "Review",
      agent: "codex",
      model: { kind: "model", id: "gpt-5.6" },
      options: { reasoning_effort: { kind: "value", value: "high" } },
      depends_on: ["step-1"],
    },
  ]);
});

it("strips the context of every competitor of a compete group", () => {
  const group = newWorkflowCompeteGroup(1);
  const plan = presetPlanFromDrafts([
    {
      ...group,
      name: "Two approaches",
      competitors: group.competitors.map((competitor, index) => ({
        ...competitor,
        name: `Candidate ${index}`,
        context: { references: [{ kind: "issue", issue_id: "issue-9" }], note: "" },
      })),
    },
  ]);

  const [node] = plan.steps;
  expect(node && "compete" in node && node.compete.every((c) => !("context" in c))).toBe(true);
});

it("restores the steps, their dependencies, their agents and their notes", () => {
  const restored = draftsFromPresetPlan(presetPlanFromDrafts(composed()));

  expect(restored.map((step) => [step.key, step.name, step.dependsOn])).toEqual([
    ["step-1", "Implement", []],
    ["step-2", "Review", ["step-1"]],
  ]);
  expect(restored[0]?.kind === "step" && restored[0].execution.agent).toBe(
    encodeProfileChoice("profile-1"),
  );
  expect(restored[0]?.kind === "step" && restored[0].context).toEqual({
    references: [],
    note: "keep it small",
  });
  expect(restored[1]?.kind === "step" && restored[1].execution.model).toEqual({
    kind: "model",
    id: "gpt-5.6",
  });
});

it("produces a plan a launch accepts", () => {
  const restored = draftsFromPresetPlan(presetPlanFromDrafts(composed()));

  expect(runPlanInputSchema.safeParse(buildRunPlanInput(restored)).success).toBe(true);
});

it("allocates a node key an applied preset does not already hold", () => {
  const applied = draftsFromPresetPlan(presetPlanFromDrafts(composed()));

  expect(freeNodeCounter(applied)).toBe(3);
});

it("names the first refusal, and counts the rest", () => {
  expect(presetBlockedReason(preset())).toBeNull();
  expect(presetBlockedReason(preset({ compatibility: { launchable: false, issues: [] } }))).toBe(
    "This preset has no step yet.",
  );
  expect(
    presetBlockedReason(
      preset({
        compatibility: {
          launchable: false,
          issues: [
            { node_id: "a", node_name: "Review", error: "profile_not_found", message: "gone" },
            { node_id: "b", node_name: "Ship", error: "runtime_unknown", message: "also gone" },
          ],
        },
      }),
    ),
  ).toBe("Review: gone (+1 more)");
});
