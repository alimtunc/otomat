import { getRun, getStepRun, listAgentSessionsForRun, listRunContributions } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ProfileOptionUnsupportedError } from "#agents";
import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { firstStepOf } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("freezes a queued message before a later next-turn model change", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete", "complete"]);
  const run = await supervisor.start({
    prompt: "do the work",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
    options: { effort: { kind: "value", value: "high" } },
  });
  const stepRunId = firstStepOf(fix.db, run.id);
  const active = listAgentSessionsForRun(fix.db, run.id)[0];
  if (!active?.config_json) throw new Error("expected the active turn's frozen config");

  supervisor.setNextTurnModel(
    run.id,
    stepRunId,
    active.id,
    active.config_json.config_hash,
    "fake-fast",
    { effort: "medium" },
  );
  const queuedConfig = getStepRun(fix.db, stepRunId)?.next_turn_config_json;
  if (!queuedConfig) throw new Error("expected a pending config");
  const contribution = await supervisor.contribute(
    run.id,
    stepRunId,
    active.id,
    queuedConfig.config_hash,
    "use the faster model",
  );

  supervisor.setNextTurnModel(
    run.id,
    stepRunId,
    active.id,
    queuedConfig.config_hash,
    "fake-thorough",
    { effort: "high" },
  );
  expect(spawn.jobs[0]?.config?.model?.id).toBe("fake-thorough");
  expect(listRunContributions(fix.db, run.id)[0]?.target_config_json?.model?.id).toBe("fake-fast");

  await supervisor.settle();

  expect(spawn.jobs[1]?.config).toMatchObject({
    model: { id: "fake-fast" },
    options: { effort: "medium" },
  });
  expect(listRunContributions(fix.db, run.id)[0]).toMatchObject({
    id: contribution.id,
    status: "acknowledged",
  });
  expect(getStepRun(fix.db, stepRunId)?.next_turn_config_json).toMatchObject({
    model: { id: "fake-thorough" },
    options: { effort: "high" },
  });
  expect(
    readRunEvents(fix.db, run.id).filter((event) => event.type === "session.model_override"),
  ).toHaveLength(2);
});

it("keeps a pending model revision across a supervisor restart", async () => {
  const first = makeSupervisor(fix, "complete");
  const run = await first.supervisor.start({
    prompt: "do the work",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
  });
  await first.supervisor.settle();
  const stepRunId = firstStepOf(fix.db, run.id);
  const session = listAgentSessionsForRun(fix.db, run.id).at(-1);
  if (!session?.config_json) throw new Error("expected a frozen session config");

  first.supervisor.setNextTurnModel(
    run.id,
    stepRunId,
    session.id,
    session.config_json.config_hash,
    "fake-fast",
    { effort: "low" },
  );
  const restarted = makeSupervisor(fix, "complete");
  const pending = getStepRun(fix.db, stepRunId)?.next_turn_config_json;
  if (!pending) throw new Error("expected the restarted supervisor to read the pending config");

  await restarted.supervisor.contribute(
    run.id,
    stepRunId,
    session.id,
    pending.config_hash,
    "continue after restart",
  );
  await restarted.supervisor.settle();

  expect(restarted.spawn.jobs[0]?.config?.model?.id).toBe("fake-fast");
  expect(getStepRun(fix.db, stepRunId)?.next_turn_config_json).toBeNull();
  const resumed = listAgentSessionsForRun(fix.db, run.id).at(-1);
  expect(resumed).toMatchObject({
    resumed_from_session_id: session.id,
    config_json: { model: { id: "fake-fast" } },
  });
});

it("rejects an effort the selected next-turn model does not announce", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({
    prompt: "do the work",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
  });
  await supervisor.settle();
  const stepRunId = firstStepOf(fix.db, run.id);
  const session = listAgentSessionsForRun(fix.db, run.id).at(-1);
  if (!session?.config_json) throw new Error("expected a frozen session config");
  const config = session.config_json;

  expect(() =>
    supervisor.setNextTurnModel(run.id, stepRunId, session.id, config.config_hash, "fake-fast", {
      effort: "high",
    }),
  ).toThrow(ProfileOptionUnsupportedError);
  expect(getStepRun(fix.db, stepRunId)?.next_turn_config_json).toBeNull();
});

it("applies a pending model revision on a plain resume, as its own audited turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete"]);
  const run = await supervisor.start({
    prompt: "do the work",
    runtime: "fake",
    model: { kind: "model", id: "fake-thorough" },
  });
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "running")).toBe(true);
  expect(
    await waitFor(() =>
      readRunEvents(fix.db, run.id).some((event) => event.type === "runtime.provider_session"),
    ),
  ).toBe(true);
  const stepRunId = firstStepOf(fix.db, run.id);
  await supervisor.stopStep(run.id, stepRunId);
  const session = listAgentSessionsForRun(fix.db, run.id).at(-1);
  if (!session?.config_json) throw new Error("expected a frozen session config");

  supervisor.setNextTurnModel(
    run.id,
    stepRunId,
    session.id,
    session.config_json.config_hash,
    "fake-fast",
    { effort: "low" },
  );
  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(spawn.jobs[1]).toMatchObject({
    mode: "resume",
    config: { model: { id: "fake-fast" }, options: { effort: "low" } },
  });
  expect(getStepRun(fix.db, stepRunId)?.next_turn_config_json).toBeNull();
  expect(listAgentSessionsForRun(fix.db, run.id).at(-1)).toMatchObject({
    resumed_from_session_id: session.id,
    provider_session_id: session.provider_session_id,
    config_json: { model: { id: "fake-fast" } },
  });
});
