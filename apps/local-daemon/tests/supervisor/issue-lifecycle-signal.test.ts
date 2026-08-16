import { join } from "node:path";

import { getIssue, getRun, schema } from "@otomat/db";
import type { LinearLifecycleSignal } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createRepositoryResolver } from "#git";
import { closeMergedRun, type AppendStepInput } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

const FIX_STEP: AppendStepInput = {
  name: "Fix review comments",
  note: "address the review",
  references: [],
  selector: { kind: "runtime", runtimeId: "fake" },
  overrides: {},
  dependsOn: [],
  replaces: null,
  origin: "review_fix",
};

let fix: DaemonTestDb;
let signals: (LinearLifecycleSignal & { run_status: string | undefined })[];

function syncIssueLifecycle(signal: LinearLifecycleSignal): void {
  signals.push({ ...signal, run_status: getRun(fix.db, signal.run_id)?.status });
}

beforeEach(() => {
  fix = setupDaemonDb();
  signals = [];
  fix.db
    .insert(schema.issues)
    .values({ id: "i-work", project_id: "p1", title: "Continue me", status: "ready" })
    .run();
});

afterEach(() => {
  vi.restoreAllMocks();
  fix.cleanup();
});

it("marks the issue started as soon as the run row exists, while it is still queued", async () => {
  const { supervisor } = makeSupervisor(fix, "complete", { syncIssueLifecycle });

  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();

  expect(signals).toEqual([
    { issue_id: "i-work", phase: "in_progress", run_id: run.id, run_status: "queued" },
  ]);
});

it("never closes the issue on a completed run, a review or a failure", async () => {
  const { supervisor } = makeSupervisor(fix, ["complete", "fail"], { syncIssueLifecycle });

  const first = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  expect(getRun(fix.db, first.id)?.status).toBe("review_ready");

  await supervisor.appendStep(first.id, FIX_STEP);
  await supervisor.settle();

  expect(signals.map((signal) => signal.phase)).toEqual(["in_progress", "in_progress"]);
  expect(getIssue(fix.db, "i-work")?.status).not.toBe("done");
});

it("keeps the tracker signal from breaking the launch that produced it", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { supervisor } = makeSupervisor(fix, "complete", {
    syncIssueLifecycle: () => {
      throw new Error("tracker exploded");
    },
  });

  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(log).toHaveBeenCalled();
});

it("closes the issue only once the pull request is confirmed merged", async () => {
  const { supervisor } = makeSupervisor(fix, "complete", { syncIssueLifecycle });
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  signals = [];

  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  closeMergedRun({ db: fix.db, repositories, syncIssueLifecycle }, run.id);

  expect(getIssue(fix.db, "i-work")?.status).toBe("done");
  expect(signals).toEqual([
    { issue_id: "i-work", phase: "done", run_id: run.id, run_status: "completed" },
  ]);
});
