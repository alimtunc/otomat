import {
  deleteWorkflowPreset,
  getRun,
  getWorkflowPreset,
  insertWorkflowPreset,
  updateWorkflowPreset,
} from "@otomat/db";
import type { WorkflowPresetPlan } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const PRESET_PLAN: WorkflowPresetPlan = {
  version: 1,
  steps: [
    { id: "implement", name: "Implement", agent: null, note: "keep it small", depends_on: [] },
    { id: "review", name: "Review", agent: null, depends_on: ["implement"] },
  ],
};

function seedPreset(): void {
  insertWorkflowPreset(fix.db, {
    id: "preset-1",
    name: "Implement, then review",
    scope: "global",
    project_id: null,
    plan_json: PRESET_PLAN,
  });
}

it("launches a preset's structure against the current issue and freezes the result", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedPreset();
  const preset = getWorkflowPreset(fix.db, "preset-1");

  const run = await supervisor.start({
    issue_id: "i1",
    plan: { version: 1, steps: preset?.plan_json.steps ?? [] },
  });
  await supervisor.settle();

  const frozen = getRun(fix.db, run.id)?.plan_json.steps ?? [];
  expect(frozen.map((step) => step.name)).toEqual(["Implement", "Review"]);
  // The preset carries no issue; the launch attaches the run's own and freezes the resolved agent.
  expect(frozen.every((step) => !("compete" in step) && step.agent === "fake")).toBe(true);
  const [implement] = frozen;
  const context = implement && !("compete" in implement) ? implement.context : null;
  expect(context?.issue?.id).toBe("i1");
  expect(context?.note).toBe("keep it small");
});

it("leaves a launched plan untouched when its preset is edited or deleted", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedPreset();
  const preset = getWorkflowPreset(fix.db, "preset-1");

  const run = await supervisor.start({
    issue_id: "i1",
    plan: { version: 1, steps: preset?.plan_json.steps ?? [] },
  });
  await supervisor.settle();
  const launched = getRun(fix.db, run.id)?.plan_json;

  updateWorkflowPreset(fix.db, "preset-1", {
    name: "Something else",
    scope: "global",
    project_id: null,
    plan_json: { version: 1, steps: [] },
  });
  expect(getRun(fix.db, run.id)?.plan_json).toEqual(launched);

  deleteWorkflowPreset(fix.db, "preset-1");
  expect(getRun(fix.db, run.id)?.plan_json).toEqual(launched);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});
