import { getRun, insertAgentProfile, listRuns, updateAgentProfile } from "@otomat/db";
import { isRunPlanCompeteGroup, type RunPlanStep, type StartRunRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ProfileOptionUnsupportedError } from "#agents";

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

/** The simulated runtime publishes levels per model, exactly as Codex does, so a model is always chosen here. */
function seedProfile(effort: string | undefined, model = "fake-thorough"): void {
  insertAgentProfile(fix.db, {
    id: "prof",
    name: "Careful",
    runtime: "fake",
    options_json: effort === undefined ? {} : { effort },
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

it("freezes the launch effort into every inheriting step and sends it on the initial turn", async () => {
  seedProfile(undefined);

  const { spawn, run } = await launch({ prompt: "do it", profile_id: "prof", effort: "high" });

  expect(frozenSteps(run.id)[0]?.config?.options).toEqual({ effort: "high" });
  expect(spawn.jobs[0]?.config?.options).toEqual({ effort: "high" });
});

it("keeps the profile's own effort when the launch names none", async () => {
  seedProfile("medium");

  const { run } = await launch({ prompt: "do it", profile_id: "prof" });

  expect(frozenSteps(run.id)[0]?.config?.options).toEqual({ effort: "medium" });
});

it("gives each step its own level, its agent's, or the run's, as the plan asks", async () => {
  seedProfile("low");

  const { run } = await launch({
    prompt: "goal",
    profile_id: "prof",
    effort: "high",
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "Inherits", agent: null, prompt: "first", depends_on: [] },
        {
          id: "b",
          name: "Keeps the agent's",
          agent: null,
          effort: { kind: "agent_default" },
          prompt: "second",
          depends_on: ["a"],
        },
        {
          id: "c",
          name: "Overrides",
          agent: null,
          effort: { kind: "level", value: "medium" },
          prompt: "third",
          depends_on: ["b"],
        },
      ],
    },
  });

  expect(frozenSteps(run.id).map((step) => step.config?.options)).toEqual([
    { effort: "high" },
    { effort: "low" },
    { effort: "medium" },
  ]);
});

it("applies the launch level to an inheriting step even when that step brings its own agent", async () => {
  seedProfile("low");
  insertAgentProfile(fix.db, {
    id: "other",
    name: "Quick",
    runtime: "fake",
    options_json: { effort: "medium" },
    model: "fake-thorough",
    guidance: null,
    skill_ids_json: [],
  });

  const { run } = await launch({
    prompt: "goal",
    profile_id: "prof",
    effort: "high",
    plan: {
      version: 1,
      steps: [
        {
          id: "a",
          name: "Own agent, same as run",
          agent: null,
          profile_id: "other",
          prompt: "go",
          depends_on: [],
        },
        {
          id: "b",
          name: "Own agent, own level",
          agent: null,
          profile_id: "other",
          effort: { kind: "agent_default" },
          prompt: "go",
          depends_on: ["a"],
        },
      ],
    },
  });

  expect(frozenSteps(run.id).map((step) => step.config?.options)).toEqual([
    { effort: "high" },
    { effort: "medium" },
  ]);
});

it("freezes a distinct level per competitor of a compete group", async () => {
  const { run } = await launch({
    prompt: "goal",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
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
              effort: { kind: "level", value: "low" },
              prompt: "first",
            },
            {
              id: "b",
              name: "Candidate B",
              agent: null,
              effort: { kind: "level", value: "high" },
              prompt: "second",
            },
          ],
        },
      ],
    },
  });

  const group = getRun(fix.db, run.id)?.plan_json.steps[0];
  const competitors = group && isRunPlanCompeteGroup(group) ? group.compete : [];
  expect(competitors.map((competitor) => competitor.config?.options)).toEqual([
    { effort: "low" },
    { effort: "high" },
  ]);
});

it("refuses a level the chosen model does not publish and launches nothing", async () => {
  seedProfile(undefined, "fake-fast");
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "do it", profile_id: "prof", effort: "high" }),
  ).rejects.toBeInstanceOf(ProfileOptionUnsupportedError);
  expect(listRuns(fix.db)).toHaveLength(0);
});

it("refuses an effort the runtime announces no option for at all", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "do it", runtime: "fake", effort: "high" }),
  ).rejects.toBeInstanceOf(ProfileOptionUnsupportedError);
  expect(listRuns(fix.db)).toHaveLength(0);
});

it("resumes with the effort frozen at launch, not the one the profile carries now", async () => {
  seedProfile("low");
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "do it", profile_id: "prof" });
  await supervisor.settle();

  updateAgentProfile(fix.db, "prof", {
    name: "Careful",
    runtime: "fake",
    options_json: { effort: "high" },
    model: "fake-thorough",
    guidance: null,
    skill_ids_json: [],
  });

  await supervisor.contribute(run.id, firstStepOf(fix.db, run.id), "keep going");
  await supervisor.settle();

  const resume = spawn.jobs[1];
  expect(resume?.mode).toBe("resume");
  expect(resume?.config?.options).toEqual({ effort: "low" });
});
