import { getIssue, getRun, listStepRunsForRun, schema, updateIssueStatus } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { RunNotResumableError } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
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

it("reattaches the provider session of a run a quota error stopped, in the same step", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "r429",
    runStatus: "failed",
    stepStatus: "stale",
    sessionStatus: "failed",
    providerSessionId: "ps-429",
  });

  expect(supervisor.resumePlan("r429")).toEqual({ mode: "native" });
  await supervisor.resume("r429");
  await supervisor.settle();

  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-429",
    stepRunId: seeded.stepRunId,
  });
  expect(getRun(fix.db, "r429")?.status).toBe("review_ready");
  // Reopening clears the stamp the failure left, so a working run never reports a completion time.
  expect(getRun(fix.db, "r429")?.completed_at).toBeNull();
  // The worktree is the one the failed run already owned: no second branch, no second row.
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
});

it("falls back to a recovery session, in the same run and step, when nothing can be reattached", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "rnp",
    runStatus: "failed",
    stepStatus: "stale",
    sessionStatus: "failed",
    providerSessionId: null,
  });

  expect(supervisor.resumePlan("rnp")).toMatchObject({ mode: "recovery" });
  await supervisor.resume("rnp");
  await supervisor.settle();

  const job = spawn.jobs[0];
  expect(job).toMatchObject({ mode: "run", providerSessionId: null, stepRunId: seeded.stepRunId });
  expect(job?.agentSessionId).not.toBe(seeded.agentSessionId);
  expect(job?.prompt).toContain("stopped before finishing");
  expect(getRun(fix.db, "rnp")?.status).toBe("review_ready");
});

it("keeps a canceled run resumable and requeues the step it stopped", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rcan",
    runStatus: "canceled",
    stepStatus: "canceled",
    sessionStatus: "terminated",
    providerSessionId: "ps-rcan",
  });

  await supervisor.resume("rcan");
  await supervisor.settle();

  expect(getRun(fix.db, "rcan")?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, "rcan")[0]?.status).toBe("succeeded");
});

it("refuses to resume a merged run, and says so before the cockpit offers it", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rmerged",
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-rmerged",
  });

  expect(supervisor.resumePlan("rmerged")).toMatchObject({ mode: "unavailable" });
  await expect(supervisor.resume("rmerged")).rejects.toThrow(/cannot be resumed/);
  expect(spawn.calls).toBe(0);
});

it("refuses to resume a run whose workspace was abandoned", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rgone",
    runStatus: "failed",
    stepStatus: "stale",
    sessionStatus: "failed",
    providerSessionId: "ps-rgone",
  });

  supervisor.abandon("rgone");

  expect(supervisor.resumePlan("rgone")).toMatchObject({ mode: "unavailable" });
  await expect(supervisor.resume("rgone")).rejects.toThrow(/no longer holds/);
  expect(spawn.calls).toBe(0);
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

it("puts the issue back to work, from an open pull request through reviewing", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rpr",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rpr",
  });
  updateIssueStatus(fix.db, "i1", "pr_open");

  await supervisor.resume("rpr");
  await supervisor.settle();

  expect(getIssue(fix.db, "i1")?.status).toBe("running");
});

it("refuses to resume a run whose issue closed with its merge", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rdone",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-rdone",
  });
  updateIssueStatus(fix.db, "i1", "done");

  await expect(supervisor.resume("rdone")).rejects.toThrow(RunNotResumableError);
  expect(spawn.calls).toBe(0);
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
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
