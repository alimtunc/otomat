import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, listAgentSessionsForRun, listStepRunsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { isProcessAlive, reconcileRuns } from "#supervisor";

import {
  completedMarker,
  deadPid,
  logEvent,
  providerSessionEvent,
  seedRun,
  setupSupervisorDb,
  spawnOrphan,
  waitFor,
  writeRunEvents,
  type SupervisorTestDb,
} from "../support/supervisor.js";

const NOW = "2026-06-24T12:00:00.000Z";

let fix: SupervisorTestDb;

beforeEach(() => {
  fix = setupSupervisorDb();
});

afterEach(() => {
  fix.cleanup();
});

it("classifies a run with a terminal marker as completed → review_ready", async () => {
  const seed = seedRun(fix.db, {
    runId: "r1",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r1", [
    providerSessionEvent(seed, "ps-r1"),
    logEvent(seed, "x"),
    completedMarker(seed, "ps-r1"),
  ]);

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled).toHaveLength(1);
  expect(report.reconciled[0]?.classification).toBe("completed");
  expect(getRun(fix.db, "r1")?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, "r1")[0]?.status).toBe("succeeded");
  expect(listAgentSessionsForRun(fix.db, "r1")[0]?.status).toBe("terminated");

  const events = readRunEvents(fix.db, "r1");
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
  expect(events.at(-1)?.type).toBe("system.reconciled");
});

it("classifies a cut ledger with a provider session as interrupted → awaiting_human + resumable", async () => {
  const seed = seedRun(fix.db, {
    runId: "r2",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r2", [providerSessionEvent(seed, "ps-r2"), logEvent(seed, "x")]);

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled[0]?.classification).toBe("interrupted");
  expect(getRun(fix.db, "r2")?.status).toBe("awaiting_human");
  expect(listStepRunsForRun(fix.db, "r2")[0]?.status).toBe("awaiting_human");
  const session = listAgentSessionsForRun(fix.db, "r2")[0];
  expect(session?.status).toBe("awaiting_input");
  expect(session?.provider_session_id).toBe("ps-r2");
});

it("classifies a dead process with no evidence as failed → stale", async () => {
  seedRun(fix.db, {
    runId: "r3",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r3", []);

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled[0]?.classification).toBe("failed");
  expect(getRun(fix.db, "r3")?.status).toBe("failed");
  expect(getRun(fix.db, "r3")?.completed_at).toBeTruthy();
  expect(listStepRunsForRun(fix.db, "r3")[0]?.status).toBe("stale");
  expect(listAgentSessionsForRun(fix.db, "r3")[0]?.status).toBe("failed");
});

it("terminates a still-alive orphan group and marks it interrupted", async () => {
  const orphan = spawnOrphan();
  try {
    const seed = seedRun(fix.db, {
      runId: "r4",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
      pid: orphan.pid,
      pgid: orphan.pgid,
    });
    writeRunEvents(fix.dataDir, "r4", [providerSessionEvent(seed, "ps-r4")]);

    const report = reconcileRuns(fix.db, fix.dataDir, NOW);

    expect(report.reconciled[0]?.orphanTerminated).toBe(true);
    expect(report.reconciled[0]?.classification).toBe("interrupted");
    expect(getRun(fix.db, "r4")?.status).toBe("awaiting_human");
    expect(await waitFor(() => !isProcessAlive(orphan.pid))).toBe(true);
  } finally {
    orphan.stop();
  }
});

it("leaves resting states alone and is idempotent (no double-emit, no double-spawn)", async () => {
  const seed = seedRun(fix.db, {
    runId: "r5",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r5", [
    providerSessionEvent(seed, "ps-r5"),
    completedMarker(seed, "ps-r5"),
  ]);
  // Resting states a crash never touches.
  seedRun(fix.db, {
    runId: "resting-rr",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  seedRun(fix.db, {
    runId: "resting-ah",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
  });

  expect(reconcileRuns(fix.db, fix.dataDir, NOW).reconciled).toHaveLength(1);
  const afterFirst = readRunEvents(fix.db, "r5").filter((e) => e.type === "system.reconciled");
  expect(afterFirst).toHaveLength(1);

  // Second pass: r5 is now review_ready (resting) → excluded; resting runs untouched.
  expect(reconcileRuns(fix.db, fix.dataDir, NOW).reconciled).toHaveLength(0);
  expect(readRunEvents(fix.db, "r5").filter((e) => e.type === "system.reconciled")).toHaveLength(1);
  expect(getRun(fix.db, "resting-rr")?.status).toBe("review_ready");
  expect(getRun(fix.db, "resting-ah")?.status).toBe("awaiting_human");
});

it("skips a truncated final line and still ingests the complete prefix", async () => {
  const seed = seedRun(fix.db, {
    runId: "r6",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r6", [providerSessionEvent(seed, "ps-r6")]);
  // A kill mid-write: an unparseable JSON fragment with no trailing newline.
  appendFileSync(join(fix.dataDir, "runs", "r6", "events.jsonl"), '{"id":"torn","run_id":"r6","ty');

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled[0]?.classification).toBe("interrupted");
  const events = readRunEvents(fix.db, "r6");
  expect(events.some((e) => e.type === "runtime.provider_session")).toBe(true);
  expect(events.some((e) => e.type === "system.reconciled")).toBe(true);
  // The corrupt fragment is dropped (a seq gap is allowed); seq stays strictly increasing + unique.
  const seqs = events.map((e) => e.seq);
  expect(seqs).toEqual(seqs.toSorted((a, b) => a - b));
  expect(new Set(seqs).size).toBe(seqs.length);
});

it("settles a queued run left in flight by a crash (semaphore window)", async () => {
  seedRun(fix.db, {
    runId: "rq",
    runStatus: "queued",
    stepStatus: "queued",
    sessionStatus: "created",
  });

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled.map((o) => o.runId)).toContain("rq");
  expect(getRun(fix.db, "rq")?.status).toBe("failed");
  expect(listStepRunsForRun(fix.db, "rq")[0]?.status).toBe("stale");
});

it("normalizes an awaiting_permission run through running to its outcome", async () => {
  const seed = seedRun(fix.db, {
    runId: "r7",
    runStatus: "awaiting_permission",
    stepStatus: "awaiting_permission",
    sessionStatus: "awaiting_input",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "r7", [providerSessionEvent(seed, "ps-r7")]);

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled[0]?.classification).toBe("interrupted");
  expect(getRun(fix.db, "r7")?.status).toBe("awaiting_human");
});
