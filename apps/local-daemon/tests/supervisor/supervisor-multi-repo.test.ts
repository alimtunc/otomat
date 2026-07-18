import { existsSync } from "node:fs";

import { getIssue, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ProjectNotFoundError } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;
let repoA: TestRepo;
let repoB: TestRepo;

beforeEach(() => {
  fix = setupDaemonDb();
  repoA = setupTestRepo();
  repoB = setupTestRepo();
  fix.db
    .insert(schema.projects)
    .values([
      { id: "pa", name: "A", root_path: repoA.root },
      { id: "pb", name: "B", root_path: repoB.root },
    ])
    .run();
  fix.db
    .insert(schema.repositories)
    .values([
      { id: "ra", project_id: "pa", name: "A", default_branch: repoA.defaultBranch },
      { id: "rb", project_id: "pb", name: "B", default_branch: repoB.defaultBranch },
    ])
    .run();
  fix.db
    .insert(schema.issues)
    .values([
      { id: "ia", project_id: "pa", title: "In A", status: "ready" },
      { id: "ib", project_id: "pb", title: "In B", status: "ready" },
    ])
    .run();
});

afterEach(() => {
  repoA.cleanup();
  repoB.cleanup();
  fix.cleanup();
});

function branches(repo: TestRepo): string[] {
  return repo
    .git("branch", "--format=%(refname:short)")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
}

it("runs two issues in two repositories concurrently without cross-repo leakage", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const runA = await supervisor.start({ issue_id: "ia" });
  const runB = await supervisor.start({ issue_id: "ib" });
  await supervisor.settle();

  expect(runA.repository_id).toBe("ra");
  expect(runB.repository_id).toBe("rb");

  const jobA = spawn.jobs.find((job) => job.runId === runA.id);
  const jobB = spawn.jobs.find((job) => job.runId === runB.id);
  expect(jobA?.worktreePath).toBeTruthy();
  expect(jobB?.worktreePath).toBeTruthy();
  expect(jobA?.worktreePath).not.toBe(jobB?.worktreePath);
  expect(existsSync(jobA?.worktreePath ?? "")).toBe(true);
  expect(existsSync(jobB?.worktreePath ?? "")).toBe(true);

  // Each run's branch exists only in its own repository.
  expect(branches(repoA)).toContain(runA.branch);
  expect(branches(repoA)).not.toContain(runB.branch);
  expect(branches(repoB)).toContain(runB.branch);
  expect(branches(repoB)).not.toContain(runA.branch);
});

it("pins an ad-hoc launch to its selected project's repository", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "work in B", project_id: "pb" });
  await supervisor.settle();

  expect(run.repository_id).toBe("rb");
  expect(getIssue(fix.db, run.issue_id)?.project_id).toBe("pb");
  expect(branches(repoB)).toContain(run.branch);
  expect(branches(repoA)).not.toContain(run.branch);
});

it("rejects an ad-hoc launch on an unknown project before writing anything", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  await expect(supervisor.start({ prompt: "x", project_id: "ghost" })).rejects.toThrow(
    ProjectNotFoundError,
  );
  expect(spawn.calls).toBe(0);
});
