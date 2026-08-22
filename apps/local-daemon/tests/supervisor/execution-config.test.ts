import {
  getRun,
  insertAgentProfile,
  listRuns,
  updateAgentProfile,
  writeExecutionDefaults,
} from "@otomat/db";
import { isRunPlanCompeteGroup, type RunPlanStep, type StartRunRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ProfileOptionUnsupportedError } from "#agents";

import { contributeToStep } from "../support/contribution.js";
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
function seedProfile(effort: string | undefined, model = "fake-thorough", id = "prof"): void {
  insertAgentProfile(fix.db, {
    id,
    name: id === "prof" ? "Careful" : "Quick",
    runtime: "fake",
    options_json: effort === undefined ? {} : { effort },
    model,
    guidance: null,
    skill_ids_json: [],
  });
}

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

it("freezes the runtime's own default and sends it, when nothing selects one", async () => {
  const { spawn, run } = await launch({
    prompt: "do it",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
  });

  expect(frozenSteps(run.id)[0]?.config?.options).toEqual({ effort: "low" });
  expect(frozenSteps(run.id)[0]?.config?.sources?.options).toEqual({ effort: "provider" });
  expect(spawn.jobs[0]?.config?.options).toEqual({ effort: "low" });
});

it("gives an appended step the same frozen default as the launch", async () => {
  const { supervisor, spawn, run } = await launch({
    prompt: "do it",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
  });

  await supervisor.appendStep(run.id, {
    name: "Follow up",
    note: "keep going",
    references: [],
    selector: { kind: "runtime", runtimeId: "fake" },
    overrides: { model: { kind: "model", id: "fake-thorough" } },
    dependsOn: [],
    replaces: null,
    origin: "user",
  });
  await supervisor.settle();

  expect(frozenSteps(run.id).map((step) => step.config?.options)).toEqual([
    { effort: "low" },
    { effort: "low" },
  ]);
  expect(spawn.jobs.map((job) => job.config?.options)).toEqual([
    { effort: "low" },
    { effort: "low" },
  ]);
});

it("freezes the launch option into every inheriting step and sends it on the initial turn", async () => {
  seedProfile(undefined);

  const { spawn, run } = await launch({
    note: "do it",
    profile_id: "prof",
    options: { effort: { kind: "value", value: "high" } },
  });

  expect(frozenSteps(run.id)[0]?.config?.options).toEqual({ effort: "high" });
  expect(frozenSteps(run.id)[0]?.config?.sources?.options).toEqual({ effort: "launch" });
  expect(spawn.jobs[0]?.config?.options).toEqual({ effort: "high" });
});

it("keeps the profile's own option when the launch names none", async () => {
  seedProfile("medium");

  const { run } = await launch({ prompt: "do it", profile_id: "prof" });

  expect(frozenSteps(run.id)[0]?.config?.options).toEqual({ effort: "medium" });
  expect(frozenSteps(run.id)[0]?.config?.sources?.options).toEqual({ effort: "profile" });
});

it("falls back to the host defaults, and says so, when neither the launch nor the profile chooses", async () => {
  writeExecutionDefaults(fix.db, {
    runtime: "fake",
    model: "fake-thorough",
    options: { effort: "low" },
  });

  const { run } = await launch({ prompt: "do it" });

  const config = frozenSteps(run.id)[0]?.config;
  expect(config?.runtime).toBe("fake");
  expect(config?.model?.id).toBe("fake-thorough");
  expect(config?.options).toEqual({ effort: "low" });
  expect(config?.sources).toEqual({
    runtime: "global",
    model: "global",
    options: { effort: "global" },
  });
});

it("ignores host defaults belonging to another runtime rather than carrying their options across", async () => {
  writeExecutionDefaults(fix.db, {
    runtime: "claude",
    model: null,
    options: { permission_mode: "plan" },
  });
  seedProfile(undefined, "fake-fast");

  const { run } = await launch({ prompt: "do it", profile_id: "prof" });

  const config = frozenSteps(run.id)[0]?.config;
  expect(config?.options).toEqual({ effort: "low" });
  expect(config?.sources?.options).toEqual({ effort: "provider" });
});

it("gives each step its own value, its agent's, or the run's, as the plan asks", async () => {
  seedProfile("low");

  const { run } = await launch({
    note: "goal",
    profile_id: "prof",
    options: { effort: { kind: "value", value: "high" } },
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "Inherits", agent: null, note: "first", depends_on: [] },
        {
          id: "b",
          name: "Keeps the agent's",
          agent: null,
          options: { effort: { kind: "agent_default" } },
          note: "second",
          depends_on: ["a"],
        },
        {
          id: "c",
          name: "Overrides",
          agent: null,
          options: { effort: { kind: "value", value: "medium" } },
          note: "third",
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
  expect(frozenSteps(run.id).map((step) => step.config?.sources?.options.effort)).toEqual([
    "launch",
    "profile",
    "step",
  ]);
});

it("does not carry the launch's options onto a step that brings its own agent", async () => {
  seedProfile("low");
  seedProfile("medium", "fake-thorough", "other");

  const { run } = await launch({
    note: "goal",
    profile_id: "prof",
    options: { effort: { kind: "value", value: "high" } },
    plan: {
      version: 1,
      steps: [
        {
          id: "a",
          name: "Own agent",
          agent: null,
          profile_id: "other",
          note: "go",
          depends_on: [],
        },
        {
          id: "b",
          name: "Own agent, own value",
          agent: null,
          profile_id: "other",
          options: { effort: { kind: "value", value: "low" } },
          note: "go",
          depends_on: ["a"],
        },
      ],
    },
  });

  expect(frozenSteps(run.id).map((step) => step.config?.options)).toEqual([
    { effort: "medium" },
    { effort: "low" },
  ]);
});

it("freezes a distinct value per competitor of a compete group", async () => {
  const { run } = await launch({
    note: "goal",
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
              options: { effort: { kind: "value", value: "low" } },
              note: "first",
            },
            {
              id: "b",
              name: "Candidate B",
              agent: null,
              options: { effort: { kind: "value", value: "high" } },
              note: "second",
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

it("refuses a value the chosen model does not publish and launches nothing", async () => {
  seedProfile(undefined, "fake-fast");
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({
      note: "do it",
      profile_id: "prof",
      options: { effort: { kind: "value", value: "high" } },
    }),
  ).rejects.toBeInstanceOf(ProfileOptionUnsupportedError);
  expect(listRuns(fix.db)).toHaveLength(0);
});

it("refuses an option the runtime announces no field for at all", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({
      note: "do it",
      runtime: "fake",
      options: { effort: { kind: "value", value: "high" } },
    }),
  ).rejects.toBeInstanceOf(ProfileOptionUnsupportedError);
  expect(listRuns(fix.db)).toHaveLength(0);
});

it("resumes with the config frozen at launch, not the one the profile carries now", async () => {
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
  writeExecutionDefaults(fix.db, {
    runtime: "fake",
    model: "fake-fast",
    options: { effort: "medium" },
  });

  await contributeToStep(fix.db, supervisor, run.id, firstStepOf(fix.db, run.id), "keep going");
  await supervisor.settle();

  const resume = spawn.jobs[1];
  expect(resume?.mode).toBe("resume");
  expect(resume?.config?.options).toEqual({ effort: "low" });
});
