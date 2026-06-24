import { getRun, listAgentSessionsForRun, listStepRunsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createSupervisor } from "#supervisor";

import {
  completedMarker,
  logEvent,
  providerSessionEvent,
  seedRun,
  setupSupervisorDb,
  workerSpawn,
  writeRunEvents,
  type SupervisorTestDb,
} from "../support/supervisor.js";

let fix: SupervisorTestDb;

beforeEach(() => {
  fix = setupSupervisorDb();
});

afterEach(() => {
  fix.cleanup();
});

it("runs a fake turn to completion in a real child process", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });

  const run = await supervisor.start({ prompt: "implement the thing" });
  expect(run.status).toBe("running");

  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  const session = listAgentSessionsForRun(fix.db, run.id)[0];
  expect(session?.pid).toBeTypeOf("number");
  expect(session?.exit_code).toBe(0);

  const events = readRunEvents(fix.db, run.id);
  expect(events.length).toBeGreaterThan(0);
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
  expect(events.some((e) => e.type === "run.lifecycle")).toBe(true);
});

it("runs a simple parallel group under the concurrency limit", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    concurrency: 2,
  });

  const runs = await Promise.all([
    supervisor.start({ prompt: "a" }),
    supervisor.start({ prompt: "b" }),
    supervisor.start({ prompt: "c" }),
  ]);
  await supervisor.settle();

  expect(spawn.calls).toBe(3);
  for (const run of runs) expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("aborts a running process to a canonical canceled state with a recorded event", async () => {
  const spawn = workerSpawn("linger");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });

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

it("resumes a human-waiting run on an explicit action via a resume turn", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  seedRun(fix.db, {
    runId: "rh",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rh",
  });

  const resumed = await supervisor.resume("rh");
  expect(resumed.status).toBe("running");
  await supervisor.settle();

  expect(getRun(fix.db, "rh")?.status).toBe("review_ready");
  expect(spawn.jobs[0]?.mode).toBe("resume");
  expect(spawn.jobs[0]?.providerSessionId).toBe("ps-rh");
});

it("refuses to resume a run that is not human-waiting (no double-spawn)", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  seedRun(fix.db, {
    runId: "rr",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  await expect(supervisor.resume("rr")).rejects.toThrow();
  expect(spawn.calls).toBe(0);
});

it("reconciles then resumes the same events.jsonl without skipping a line", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  const seed = seedRun(fix.db, {
    runId: "rrr",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: 2_000_001,
  });
  writeRunEvents(fix.dataDir, "rrr", [
    providerSessionEvent(seed, "ps-rrr"),
    logEvent(seed, "before"),
  ]);

  await supervisor.reconcile();
  expect(getRun(fix.db, "rrr")?.status).toBe("awaiting_human");

  await supervisor.resume("rrr");
  await supervisor.settle();

  expect(getRun(fix.db, "rrr")?.status).toBe("review_ready");
  const events = readRunEvents(fix.db, "rrr");
  // Contiguous seq with no gap, and the resume turn's first line (a 2nd provider_session) survived.
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
  expect(events.filter((e) => e.type === "runtime.provider_session")).toHaveLength(2);
  expect(events.some((e) => e.type === "system.reconciled")).toBe(true);
});

it("abort honors a worker that already completed, never faking a cancel", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  const seed = seedRun(fix.db, {
    runId: "rac",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: 2_000_002,
  });
  // Worker finished (marker on disk) but the daemon never settled it before abort arrives.
  writeRunEvents(fix.dataDir, "rac", [
    providerSessionEvent(seed, "ps"),
    completedMarker(seed, "ps"),
  ]);

  await supervisor.abort("rac");

  expect(getRun(fix.db, "rac")?.status).toBe("review_ready");
});

it("rejects a concurrent second resume of the same run (no double-spawn)", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  seedRun(fix.db, {
    runId: "rcr",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rcr",
  });

  const results = await Promise.allSettled([supervisor.resume("rcr"), supervisor.resume("rcr")]);
  await supervisor.settle();

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(spawn.calls).toBe(1);
});

it("does not spawn a worker for a run aborted while queued on the semaphore", async () => {
  const spawn = workerSpawn("linger");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
    concurrency: 1,
  });
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

it("never spawns during boot reconciliation", async () => {
  const spawn = workerSpawn("complete");
  const supervisor = createSupervisor({
    db: fix.db,
    dataDir: fix.dataDir,
    defaultProjectId: "p1",
    spawn,
  });
  seedRun(fix.db, {
    runId: "rc",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  const report = await supervisor.reconcile();

  expect(spawn.calls).toBe(0);
  expect(report.reconciled).toHaveLength(1);
  expect(getRun(fix.db, "rc")?.status).toBe("failed");
});
