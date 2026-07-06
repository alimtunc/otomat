import { getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import {
  expectContiguousSeqs,
  logEvent,
  providerSessionEvent,
  writeRunEvents,
} from "../support/run-event-fixtures.js";
import { seedRun } from "../support/seed.js";
import { deadPid } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("reconciles then resumes the same events.jsonl without skipping a line", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const seed = seedRun(fix.db, {
    runId: "rrr",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    pid: await deadPid(),
  });
  writeRunEvents(fix.dataDir, "rrr", [
    providerSessionEvent(seed, "ps-rrr"),
    logEvent(seed, "before"),
  ]);

  supervisor.reconcile();
  expect(getRun(fix.db, "rrr")?.status).toBe("awaiting_human");

  await supervisor.resume("rrr");
  await supervisor.settle();

  expect(getRun(fix.db, "rrr")?.status).toBe("review_ready");
  const events = readRunEvents(fix.db, "rrr");
  // No seq gap, and the resume turn's first line (a 2nd provider_session) survived.
  expectContiguousSeqs(events);
  expect(events.filter((e) => e.type === "runtime.provider_session")).toHaveLength(2);
  expect(events.some((e) => e.type === "system.reconciled")).toBe(true);
});

it("never spawns during boot reconciliation", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rc",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  const report = supervisor.reconcile();

  expect(spawn.calls).toBe(0);
  expect(report.reconciled).toHaveLength(1);
  expect(getRun(fix.db, "rc")?.status).toBe("failed");
});
