import { getRun, listStepRunsForRun, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { providerSessionEvent, writeRunEvents } from "../support/run-event-fixtures.js";
import { seedWorkflowRun } from "../support/seed.js";
import { deadPid } from "../support/spawn.js";
import { appendStepInput, makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({ id: "i-work", project_id: "p1", title: "Continue me", status: "ready" })
    .run();
});

afterEach(() => {
  fix.cleanup();
});

const FOLLOW_UP = appendStepInput({ name: "Write the docs", note: "document it" });

function stepStatuses(runId: string): string[] {
  return listStepRunsForRun(fix.db, runId).map((step) => step.status);
}

it("keeps a step that waits on the live one queued until it succeeds, then starts it", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  await waitFor(() => spawn.calls === 1);
  const [first] = listStepRunsForRun(fix.db, run.id);
  if (!first) throw new Error("launch seeded no step");

  await supervisor.appendStep(run.id, { ...FOLLOW_UP, dependsOn: [first.id] });
  expect(spawn.calls).toBe(1);
  expect(stepStatuses(run.id).at(-1)).toBe("queued");

  await supervisor.settle();
  expect(spawn.calls).toBe(2);
  expect(stepStatuses(run.id)).toEqual(["succeeded", "succeeded"]);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("starts a parallel step at once beside the live turn and keeps the run working", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  await waitFor(() => getRun(fix.db, run.id)?.status === "running");
  const [first] = listStepRunsForRun(fix.db, run.id);
  if (!first) throw new Error("launch seeded no step");

  const appended = await supervisor.appendStep(run.id, { ...FOLLOW_UP, parallel: true });
  expect(appended.plan_json.steps.at(-1)).toMatchObject({ depends_on: [], parallel: true });
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);
  expect(spawn.jobs[1]?.worktreePath).toBe(spawn.jobs[0]?.worktreePath);

  expect(await waitFor(() => stepStatuses(run.id).at(-1) === "succeeded")).toBe(true);
  expect(stepStatuses(run.id)).toEqual(["running", "succeeded"]);
  expect(getRun(fix.db, run.id)?.status).toBe("running");
  const revision = readRunEvents(fix.db, run.id).find((event) => event.type === "run.plan_revised");
  expect(revision?.payload).toMatchObject({ parallel: true, depends_on: [] });

  await supervisor.stopStep(run.id, first.id);
  expect(stepStatuses(run.id)).toEqual(["awaiting_human", "succeeded"]);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
});

it("recovers two live steps after a restart: each rests, and resume reopens them one at a time", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seed = seedWorkflowRun(fix.db, {
    runId: "twin",
    issueId: "i-work",
    runStatus: "running",
    steps: [
      {
        id: "implement",
        status: "running",
        session: { status: "active", providerSessionId: "ps-implement", pid: await deadPid() },
      },
      {
        id: "docs",
        status: "running",
        parallel: true,
        session: { status: "active", providerSessionId: "ps-docs", pid: await deadPid() },
      },
    ],
  });
  writeRunEvents(fix.dataDir, "twin", [
    providerSessionEvent(seed("implement"), "ps-implement"),
    providerSessionEvent(seed("docs"), "ps-docs"),
  ]);

  supervisor.reconcile();
  expect(spawn.calls).toBe(0);
  expect(stepStatuses("twin")).toEqual(["awaiting_human", "awaiting_human"]);
  expect(getRun(fix.db, "twin")?.status).toBe("awaiting_human");

  await supervisor.resume("twin");
  await supervisor.settle();
  expect(stepStatuses("twin")).toEqual(["succeeded", "awaiting_human"]);
  expect(getRun(fix.db, "twin")?.status).toBe("awaiting_human");

  await supervisor.resume("twin");
  await supervisor.settle();
  expect(stepStatuses("twin")).toEqual(["succeeded", "succeeded"]);
  expect(getRun(fix.db, "twin")?.status).toBe("review_ready");
});
