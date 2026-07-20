import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, listAgentSessionsForRun, listStepRunsForRun, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents, runEventsPath, sessionDir } from "#events";
import { isProcessAlive, reconcileRuns } from "#supervisor";
import {
  readProcessStartTime,
  WORKER_IDENTITY_FILE,
  writeWorkerIdentity,
} from "#supervisor/identity";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import {
  completedMarker,
  expectContiguousSeqs,
  logEvent,
  providerSessionEvent,
  writeRunEvents,
} from "../support/run-event-fixtures.js";
import { seedRun } from "../support/seed.js";
import { deadPid, spawnOrphan } from "../support/spawn.js";

const NOW = "2026-06-24T12:00:00.000Z";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
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
  expectContiguousSeqs(events);
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

it("terminates a still-alive orphan group whose identity is proven, and marks it interrupted", async () => {
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
    // A real worker stamps its identity next to its pid; here we simulate that for the live orphan.
    writeWorkerIdentity(
      sessionDir(fix.dataDir, "r4", seed.agentSessionId),
      orphan.pid,
      orphan.pgid,
    );
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

it("does not signal an alive pid with no recorded identity; settles it from the ledger", async () => {
  const orphan = spawnOrphan();
  try {
    const seed = seedRun(fix.db, {
      runId: "r4b",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
      pid: orphan.pid,
      pgid: orphan.pgid,
    });
    // No worker.json written → identity unprovable → the group must be left untouched.
    writeRunEvents(fix.dataDir, "r4b", [providerSessionEvent(seed, "ps-r4b")]);

    const report = reconcileRuns(fix.db, fix.dataDir, NOW);

    expect(report.reconciled[0]?.orphanTerminated).toBe(false);
    expect(report.reconciled[0]?.classification).toBe("interrupted");
    expect(getRun(fix.db, "r4b")?.status).toBe("awaiting_human");
    expect(listAgentSessionsForRun(fix.db, "r4b")[0]?.status).toBe("awaiting_input");
    expect(isProcessAlive(orphan.pid)).toBe(true);
    expect(readRunEvents(fix.db, "r4b").some((e) => e.type === "system.reconciled")).toBe(true);
  } finally {
    orphan.stop();
  }
});

it("does not signal an alive pid the OS reused (identity start-time mismatch)", async () => {
  const orphan = spawnOrphan();
  try {
    const seed = seedRun(fix.db, {
      runId: "r4c",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
      pid: orphan.pid,
      pgid: orphan.pgid,
    });
    writeRunEvents(fix.dataDir, "r4c", [providerSessionEvent(seed, "ps-r4c")]);
    // Identity recorded for this pid, but with a start-time that no longer matches the live process —
    // exactly what a reused pid looks like after a long daemon downtime.
    const stale = readProcessStartTime(orphan.pid) ?? "Mon Jan  1 00:00:00 2000";
    const identityDir = sessionDir(fix.dataDir, "r4c", seed.agentSessionId);
    mkdirSync(identityDir, { recursive: true });
    writeFileSync(
      join(identityDir, WORKER_IDENTITY_FILE),
      JSON.stringify({ pid: orphan.pid, pgid: orphan.pgid, start_time: `stale ${stale}` }),
    );

    const report = reconcileRuns(fix.db, fix.dataDir, NOW);

    expect(report.reconciled[0]?.orphanTerminated).toBe(false);
    expect(report.reconciled[0]?.classification).toBe("interrupted");
    expect(getRun(fix.db, "r4c")?.status).toBe("awaiting_human");
    expect(isProcessAlive(orphan.pid)).toBe(true);
    expect(readRunEvents(fix.db, "r4c").some((e) => e.type === "system.reconciled")).toBe(true);
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
  appendFileSync(runEventsPath(fix.dataDir, "r6"), '{"id":"torn","run_id":"r6","ty');

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

it("settles a corrupt plan_json run as failed instead of hiding it", () => {
  fix.db
    .insert(schema.runs)
    .values({ id: "rx", issue_id: "i1", status: "running", branch: "b", plan_json: { nope: true } })
    .run();
  writeRunEvents(fix.dataDir, "rx", []);

  const report = reconcileRuns(fix.db, fix.dataDir, NOW);

  expect(report.reconciled.map((o) => o.runId)).toContain("rx");
  const row = fix.db
    .select()
    .from(schema.runs)
    .all()
    .find((r) => r.id === "rx");
  expect(row?.status).toBe("failed");
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
