import { existsSync } from "node:fs";
import { join } from "node:path";

import { getRun, schema } from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { RunNotResumableError, type ReconcileOutcome } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { anchorProjectRoot } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

function seedReviewReady(runId: string, providerSessionId: string | null = `ps-${runId}`) {
  return seedRun(fix.db, {
    runId,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId,
  });
}

it("spawns an honest resume turn with the caller's fix prompt on a review-ready run", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedReviewReady("rf");

  const run = await supervisor.fix("rf", "Fix the review comments: rename beta.");
  expect(run.status).toBe("running");
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(1);
  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-rf",
    prompt: "Fix the review comments: rename beta.",
  });
  expect(getRun(fix.db, "rf")?.status).toBe("review_ready");
});

it("refuses a fix on a run that is not review-ready", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rrun",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  await expect(supervisor.fix("rrun", "p")).rejects.toThrow(RunNotResumableError);
  expect(spawn.calls).toBe(0);
});

it("refuses a fix without a provider session to resume", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedReviewReady("rnosess", null);

  await expect(supervisor.fix("rnosess", "p")).rejects.toThrow(RunNotResumableError);
  expect(spawn.calls).toBe(0);
});

it("notifies afterSettle when a turn settles live", async () => {
  const outcomes: ReconcileOutcome[] = [];
  const { supervisor } = makeSupervisor(fix, "complete", {
    afterSettle: (outcome) => outcomes.push(outcome),
  });
  seedReviewReady("rhook");

  await supervisor.fix("rhook", "fix it");
  await supervisor.settle();

  expect(outcomes).toHaveLength(1);
  expect(outcomes[0]).toMatchObject({ runId: "rhook", classification: "completed" });
});

describe("worktree acquisition", () => {
  let repo: TestRepo;
  let service: GitWorktreeService;

  beforeEach(() => {
    repo = setupTestRepo();
    fix.db
      .insert(schema.repositories)
      .values({ id: "repo-1", project_id: "p1", name: "R", default_branch: repo.defaultBranch })
      .run();
    anchorProjectRoot(fix.db, repo.root);
    service = createGitWorktreeService({
      db: fix.db,
      repositoryId: "repo-1",
      repoRoot: repo.root,
      defaultBranch: repo.defaultBranch,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    });
  });

  afterEach(() => {
    repo.cleanup();
  });

  it("acquires an isolated worktree in the project's repository and threads its path into the job", async () => {
    const { supervisor, spawn } = makeSupervisor(fix, "complete");

    const run = await supervisor.start({ prompt: "implement the thing" });
    await supervisor.settle();

    expect(run.repository_id).toBe("repo-1");
    expect(run.worktree_id).not.toBeNull();
    const job = spawn.jobs[0];
    expect(job?.worktreePath).toBeTruthy();
    expect(existsSync(job?.worktreePath ?? "")).toBe(true);
    expect(service.get(run.id)?.branch).toBe(run.branch);
  });
});

it("runs without a worktree when the project has no repository", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "no git here" });
  await supervisor.settle();

  expect(run.repository_id).toBeNull();
  expect(run.worktree_id).toBeNull();
  expect(spawn.jobs[0]?.worktreePath).toBeNull();
});
