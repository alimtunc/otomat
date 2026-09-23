import { getRun, listAgentSessionsForRun, listStepRunsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createReexecSpawn, type Supervisor } from "#supervisor";
import { WorkerSpawnError } from "#supervisor/process";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { logTexts } from "../support/ledger.js";
import { providerSessionEvent, writeRunEvents } from "../support/run-event-fixtures.js";
import { seedRun } from "../support/seed.js";
import { FAKE_WORKER } from "../support/spawn.js";
import { supervisorWithSpawn } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

function oversizedJobSupervisor(): Supervisor {
  const reexec = createReexecSpawn(FAKE_WORKER);
  return supervisorWithSpawn(fix, (job) => reexec({ ...job, prompt: "x".repeat(2 ** 22) }));
}

it("fails a launched run whose worker the OS refused, with the errno in its ledger", async () => {
  const supervisor = oversizedJobSupervisor();

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual(["stale"]);
  expect(logTexts(fix.db, run.id)).toContainEqual(
    expect.stringMatching(/^\[otomat\] the worker could not be started: spawn .*E2BIG/),
  );
});

it("fails a run whose spawn is refused after the child was returned", async () => {
  const supervisor = supervisorWithSpawn(fix, () => ({
    pid: -1,
    pgid: -1,
    spawned: Promise.reject(new WorkerSpawnError(new Error("spawn ENOENT"))),
    exited: Promise.resolve({ code: null, signal: null }),
    start: () => undefined,
    kill: () => undefined,
  }));

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  expect(logTexts(fix.db, run.id)).toContain(
    "[otomat] the worker could not be started: spawn ENOENT",
  );
});

it("fails a refused resume instead of leaving its provider session resumable", async () => {
  const supervisor = oversizedJobSupervisor();
  const seed = seedRun(fix.db, {
    runId: "rh",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rh",
  });
  writeRunEvents(fix.dataDir, "rh", [providerSessionEvent(seed, "ps-rh")]);

  await expect(supervisor.resume("rh")).rejects.toBeInstanceOf(WorkerSpawnError);
  await supervisor.settle();

  expect(getRun(fix.db, "rh")?.status).toBe("failed");
  expect(listAgentSessionsForRun(fix.db, "rh").map((session) => session.status)).toEqual([
    "failed",
  ]);
  expect(logTexts(fix.db, "rh")).toContainEqual(expect.stringContaining("E2BIG"));
});
