import { getRun } from "@otomat/db";
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

it("resumes a human-waiting run with the user's own prompt", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "fh",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-fh",
  });

  const run = await supervisor.followUp("fh", "Also add tests for the parser.");
  expect(run.status).toBe("running");
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(1);
  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-fh",
    prompt: "Also add tests for the parser.",
  });
});

it("resumes a review-ready run with the user's own prompt", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "fr",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-fr",
  });

  const run = await supervisor.followUp("fr", "Rename the helper before merging.");
  expect(run.status).toBe("running");
  await supervisor.settle();

  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-fr",
    prompt: "Rename the helper before merging.",
  });
  expect(getRun(fix.db, "fr")?.status).toBe("review_ready");
});

it.each(["running", "completed", "failed", "canceled"] as const)(
  "refuses a follow-up on a %s run",
  async (status) => {
    const { supervisor, spawn } = makeSupervisor(fix, "complete");
    seedRun(fix.db, {
      runId: `f-${status}`,
      runStatus: status,
      stepStatus: "running",
      sessionStatus: "active",
      providerSessionId: "ps-x",
    });

    await expect(supervisor.followUp(`f-${status}`, "p")).rejects.toThrow(RunNotResumableError);
    expect(spawn.calls).toBe(0);
  },
);

it("refuses a follow-up without a provider session to resume", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "fnosess",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: null,
  });

  await expect(supervisor.followUp("fnosess", "p")).rejects.toThrow(RunNotResumableError);
  expect(spawn.calls).toBe(0);
});

it("refuses an unknown run", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  await expect(supervisor.followUp("nope", "p")).rejects.toThrow(RunNotResumableError);
  expect(spawn.calls).toBe(0);
});

it("rejects a concurrent second follow-up of the same run (no double-spawn)", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "fcr",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-fcr",
  });

  const results = await Promise.allSettled([
    supervisor.followUp("fcr", "first"),
    supervisor.followUp("fcr", "second"),
  ]);
  await supervisor.settle();

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(spawn.calls).toBe(1);
});
