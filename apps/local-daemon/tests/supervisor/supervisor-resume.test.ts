import { getRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { seedRun } from "../support/seed.js";
import { setupSupervisorDb, type SupervisorTestDb } from "../support/supervisor-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: SupervisorTestDb;

beforeEach(() => {
  fix = setupSupervisorDb();
});

afterEach(() => {
  fix.cleanup();
});

it("resumes a human-waiting run on an explicit action via a resume turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
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
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rr",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  await expect(supervisor.resume("rr")).rejects.toThrow();
  expect(spawn.calls).toBe(0);
});

it("rejects a concurrent second resume of the same run (no double-spawn)", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
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
