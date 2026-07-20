import { getRun, listStepRunsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createRepositoryResolver } from "#git";
import { createSupervisor, isProcessAlive, type SpawnSession, type Supervisor } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import {
  completedMarker,
  providerSessionEvent,
  writeRunEvents,
} from "../support/run-event-fixtures.js";
import { seedRun } from "../support/seed.js";
import { deadPid } from "../support/spawn.js";
import { workerSpawn } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("aborts a running process to a canonical canceled state with a recorded event", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");

  const run = await supervisor.start({ prompt: "long task" });
  expect(run.status).toBe("running");

  await supervisor.abort(run.id);
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("canceled");
  expect(getRun(fix.db, run.id)?.completed_at).toBeTruthy();
  expect(listStepRunsForRun(fix.db, run.id)[0]?.status).toBe("canceled");

  const events = readRunEvents(fix.db, run.id);
  const finalEvents = events.filter(
    (e) => e.type === "run.lifecycle" && e.payload["final_status"] === "canceled",
  );
  expect(finalEvents.length).toBeGreaterThanOrEqual(1);
});

it("abort honors a worker that already completed, never faking a cancel", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const seed = seedRun(fix.db, {
    runId: "rac",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  // Worker finished (marker on disk) but the daemon never settled it before abort arrives.
  writeRunEvents(fix.dataDir, "rac", [
    providerSessionEvent(seed, "ps"),
    completedMarker(seed, "ps"),
  ]);

  await supervisor.abort("rac");

  expect(getRun(fix.db, "rac")?.status).toBe("review_ready");
});

it("does not spawn a worker for a run aborted while queued on the semaphore", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const holder = await supervisor.start({ prompt: "holds the only slot" });
  expect(getRun(fix.db, holder.id)?.status).toBe("running");

  seedRun(fix.db, {
    runId: "rqa",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rqa",
  });
  const parked = supervisor.resume("rqa"); // blocks on the saturated semaphore

  await supervisor.abort("rqa"); // cancel while it is queued, before it ever spawns
  expect(getRun(fix.db, "rqa")?.status).toBe("canceled");

  await supervisor.abort(holder.id); // free the slot so the parked turn wakes
  await parked;
  await supervisor.settle();

  expect(getRun(fix.db, "rqa")?.status).toBe("canceled");
  expect(spawn.calls).toBe(1); // only the holder spawned; the aborted run never did
});

it("never releases a spawned worker when abort lands during durable startup", async () => {
  const worker = workerSpawn("linger");
  let supervisor: Supervisor;
  let aborting: Promise<void> | null = null;
  let released = 0;
  let workerPid = -1;
  const spawn: SpawnSession = (job) => {
    const proc = worker(job);
    workerPid = proc.pid;
    const release = proc.start;
    proc.start = () => {
      released += 1;
      release();
    };
    aborting = supervisor.abort(job.runId);
    return proc;
  };
  supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    repositories: createRepositoryResolver({
      db: fix.db,
      worktreesRoot: `${fix.dataDir}/worktrees`,
    }),
  });

  const run = await supervisor.start({ prompt: "abort in the start gate" });
  if (!aborting) throw new Error("abort did not start during spawn");
  await aborting;

  expect(released).toBe(0);
  expect(isProcessAlive(workerPid)).toBe(false);
  expect(getRun(fix.db, run.id)?.status).toBe("canceled");
});
