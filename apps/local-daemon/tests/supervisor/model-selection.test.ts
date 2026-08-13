import { getRun, insertAgentProfile, listRuns, updateAgentProfile } from "@otomat/db";
import { isRunPlanCompeteGroup, type RunPlanStep, type StartRunRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ModelSelectionRefusedError } from "#runtime";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { firstStepOf } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

function seedProfile(model: string | null): void {
  insertAgentProfile(fix.db, {
    id: "prof",
    name: "Careful",
    runtime: "fake",
    options_json: {},
    model,
    guidance: null,
    skill_ids_json: [],
  });
}

/** The frozen executable steps of a run, in plan order. */
function frozenSteps(runId: string): RunPlanStep[] {
  const plan = getRun(fix.db, runId)?.plan_json;
  return (plan?.steps ?? []).flatMap((node) => (isRunPlanCompeteGroup(node) ? [] : [node]));
}

async function launch(request: StartRunRequest) {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start(request);
  await supervisor.settle();
  return { supervisor, spawn, run };
}

it("freezes the profile's model with its provenance and sends it on the initial turn", async () => {
  seedProfile("fake-fast");

  const { spawn, run } = await launch({ prompt: "do it", profile_id: "prof" });

  expect(frozenSteps(run.id)[0]?.config?.model).toEqual({ id: "fake-fast", source: "static" });
  expect(spawn.jobs[0]?.config?.model).toEqual({ id: "fake-fast", source: "static" });
});

it("sends no model at all when the profile requests the provider default", async () => {
  seedProfile(null);

  const { spawn, run } = await launch({ prompt: "do it", profile_id: "prof" });

  expect(frozenSteps(run.id)[0]?.config?.model).toBeNull();
  expect(spawn.jobs[0]?.config?.model).toBeNull();
});

it("lets a launch override replace the profile's model for the run", async () => {
  seedProfile("fake-fast");

  const { run } = await launch({
    note: "do it",
    profile_id: "prof",
    model: { kind: "model", id: "fake-thorough" },
  });

  expect(frozenSteps(run.id)[0]?.config?.model).toEqual({ id: "fake-thorough", source: "static" });
});

it("gives each plan step its own model while an untouched step inherits the launch override", async () => {
  seedProfile("fake-fast");

  const { run } = await launch({
    note: "goal",
    profile_id: "prof",
    model: { kind: "model", id: "fake-thorough" },
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "Inherits", agent: null, note: "first", depends_on: [] },
        {
          id: "b",
          name: "Overrides",
          agent: null,
          model: { kind: "provider_default" },
          note: "second",
          depends_on: ["a"],
        },
      ],
    },
  });

  const steps = frozenSteps(run.id);
  expect(steps[0]?.config?.model).toEqual({ id: "fake-thorough", source: "static" });
  expect(steps[1]?.config?.model).toBeNull();
});

it("freezes a distinct model per competitor of a compete group", async () => {
  const { run } = await launch({
    note: "goal",
    runtime: "fake",
    plan: {
      version: 1,
      steps: [
        {
          id: "race",
          name: "Race",
          depends_on: [],
          compete: [
            {
              id: "a",
              name: "Candidate A",
              agent: null,
              model: { kind: "model", id: "fake-fast" },
              note: "first",
            },
            {
              id: "b",
              name: "Candidate B",
              agent: null,
              model: { kind: "model", id: "fake-thorough" },
              note: "second",
            },
          ],
        },
      ],
    },
  });

  const group = getRun(fix.db, run.id)?.plan_json.steps[0];
  const competitors = group && isRunPlanCompeteGroup(group) ? group.compete : [];
  expect(competitors.map((competitor) => competitor.config?.model)).toEqual([
    { id: "fake-fast", source: "static" },
    { id: "fake-thorough", source: "static" },
  ]);
});

it("refuses a model the runtime does not list and launches nothing", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "do it", runtime: "fake", model: { kind: "model", id: "gpt-5" } }),
  ).rejects.toBeInstanceOf(ModelSelectionRefusedError);
  expect(listRuns(fix.db)).toHaveLength(0);
});

it("resumes with the model frozen at launch, not the one the profile carries now", async () => {
  seedProfile("fake-fast");
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "do it", profile_id: "prof" });
  await supervisor.settle();

  updateAgentProfile(fix.db, "prof", {
    name: "Careful",
    runtime: "fake",
    options_json: {},
    model: "fake-thorough",
    guidance: null,
    skill_ids_json: [],
  });

  await supervisor.contribute(run.id, firstStepOf(fix.db, run.id), "keep going");
  await supervisor.settle();

  const resume = spawn.jobs[1];
  expect(resume?.mode).toBe("resume");
  expect(resume?.config?.model).toEqual({ id: "fake-fast", source: "static" });
});
