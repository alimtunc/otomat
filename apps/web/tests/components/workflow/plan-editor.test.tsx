// @vitest-environment happy-dom
import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { WorkflowPlanEditor } from "@web/components/workflow/plan-editor";
import { usePlanDraft } from "@web/components/workflow/use-plan-draft";
import { EMPTY_EXECUTION_SELECTION } from "@web/lib/execution/selection";
import { newWorkflowStep, type WorkflowNodeDraft } from "@web/lib/workflow-draft";
import { afterEach, expect, it, vi } from "vitest";

import { click } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { mount } from "#support/mount";

vi.mock("@web/components/execution/execution-config-picker", () => ({
  ExecutionConfigPicker: ({ label }: { label: string }) => (
    <div data-testid="execution-picker" data-label={label} />
  ),
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

function Harness({ initial }: { initial: WorkflowNodeDraft[] }) {
  const plan = usePlanDraft(() => initial);
  return (
    <WorkflowPlanEditor
      plan={plan}
      execution={{
        agents: { descriptors: [], profiles: [], skills: [] },
        inherited: EMPTY_EXECUTION_SELECTION,
      }}
      projectId={null}
      error={null}
    />
  );
}

async function mountPlan(stepCount: number) {
  const steps = Array.from({ length: stepCount }, (_, index) => newWorkflowStep(index + 1));
  const mounted = await mount(<Harness initial={steps} />);
  cleanups.push(mounted.cleanup);
}

it("shows every step's execution picker without a disclosure to open first", async () => {
  await mountPlan(2);

  expect(document.querySelectorAll("[data-testid='execution-picker']")).toHaveLength(2);
  expect(findLabelled("Override Step 1 execution")).toBeUndefined();
});

it("offers Add step and Add compete group as two adjacent buttons, with no step-type menu", async () => {
  await mountPlan(1);

  const addStep = findButton("Add step");
  const addCompete = findButton("Add compete group");
  expect(addStep?.disabled).toBe(false);
  expect(addCompete?.disabled).toBe(false);
  expect(addCompete?.parentElement).toBe(addStep?.parentElement);
  expect(findLabelled("More step types")).toBeUndefined();

  await click("Add compete group");
  expect(findLabelled("Compete group 2 objective")).not.toBeUndefined();
});

it("disables a compete group one executable before the plan limit, and a step at it", async () => {
  await mountPlan(RUN_PLAN_MAX_STEPS - 1);
  expect(findButton("Add step")?.disabled).toBe(false);
  expect(findButton("Add compete group")?.disabled).toBe(true);

  await click("Add step");
  expect(findButton("Add step")?.disabled).toBe(true);
  expect(findButton("Add compete group")?.disabled).toBe(true);
});
