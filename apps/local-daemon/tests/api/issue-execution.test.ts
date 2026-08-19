import { createClient, schema, type Db } from "@otomat/db";
import type {
  PullRequestPublicationState,
  PullRequestState,
  RunState,
  StepRunState,
} from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readIssue, readIssues, readRuns } from "#api/reads";

import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-issue-exec-");
});

afterEach(() => {
  t.cleanup();
});

/** Omitting `createdAt` exercises the production path: `insertRun` never sets it, so SQLite's CURRENT_TIMESTAMP does. */
function addRun(
  db: Db,
  run: { id: string; status: RunState; issueId?: string; createdAt?: string },
): void {
  const row: typeof schema.runs.$inferInsert = {
    id: run.id,
    issue_id: run.issueId ?? "i1",
    status: run.status,
    branch: `otomat/${run.id}`,
    plan_json: { version: 1, steps: [] },
  };
  if (run.createdAt) {
    row.created_at = run.createdAt;
    row.updated_at = run.createdAt;
  }
  db.insert(schema.runs).values(row).run();
}

function addPullRequest(
  db: Db,
  pr: {
    id: string;
    issueId: string;
    runId: string;
    status: PullRequestState;
    publication: PullRequestPublicationState;
  },
): void {
  db.insert(schema.pullRequests)
    .values({
      id: pr.id,
      issue_id: pr.issueId,
      run_id: pr.runId,
      status: pr.status,
      publication_status: pr.publication,
    })
    .run();
}

/** The worktree a stopped run still owns; without one there is nothing to recover, and the projection says so. */
function addWorktree(db: Db, runId: string): void {
  db.insert(schema.worktrees)
    .values({
      id: `${runId}-worktree`,
      repository_id: seedRepository(db),
      path: `/tmp/${runId}`,
      branch: `otomat/${runId}`,
      head_sha: "",
      base_sha: "",
      base_ref: "main",
      owner_token: runId,
      status: "active",
    })
    .run();
  db.update(schema.runs)
    .set({ worktree_id: `${runId}-worktree` })
    .where(eq(schema.runs.id, runId))
    .run();
}

function addStep(
  db: Db,
  step: { runId: string; id: string; idx: number; status: StepRunState; name: string },
): void {
  db.insert(schema.stepRuns)
    .values({
      id: step.id,
      run_id: step.runId,
      idx: step.idx,
      name: step.name,
      status: step.status,
    })
    .run();
}

function readI1(db: Db) {
  const issue = readIssue(db, "i1");
  if (!issue) throw new Error("i1 missing");
  return issue;
}

it("surfaces an active run as running without touching the source status", () => {
  addRun(t.db, { id: "r1", status: "running" });
  const issue = readI1(t.db);
  expect(issue.execution).toEqual({ state: "running", run_id: "r1" });
  expect(issue.status).toBe("backlog");
  const listed = readIssues(t.db, "p1").find((entry) => entry.id === "i1");
  expect(listed?.execution).toEqual({ state: "running", run_id: "r1" });
});

it("surfaces a review_ready run as reviewing", () => {
  addRun(t.db, { id: "r1", status: "review_ready" });
  expect(readI1(t.db).execution).toEqual({ state: "reviewing", run_id: "r1" });
});

it("surfaces a really-created, open pull request as pr_open", () => {
  addRun(t.db, { id: "r1", status: "completed" });
  addPullRequest(t.db, {
    id: "pr1",
    issueId: "i1",
    runId: "r1",
    status: "open",
    publication: "created",
  });
  expect(readI1(t.db).execution).toEqual({ state: "pr_open", run_id: "r1" });
});

it("does not treat a merged or not-yet-created PR as open", () => {
  addRun(t.db, { id: "r1", status: "completed" });
  addPullRequest(t.db, {
    id: "pr1",
    issueId: "i1",
    runId: "r1",
    status: "merged",
    publication: "created",
  });
  addRun(t.db, { id: "r2", status: "completed" });
  addPullRequest(t.db, {
    id: "pr2",
    issueId: "i1",
    runId: "r2",
    status: "open",
    publication: "creating",
  });
  expect(readI1(t.db).execution).toEqual({ state: "none", run_id: null });
});

it("keeps live work ahead of an older terminal run with an open PR", () => {
  addRun(t.db, { id: "old", status: "completed", createdAt: "2026-01-01 00:00:00" });
  addPullRequest(t.db, {
    id: "pr1",
    issueId: "i1",
    runId: "old",
    status: "open",
    publication: "created",
  });
  addRun(t.db, { id: "new", status: "running", createdAt: "2026-01-02 00:00:00" });
  expect(readI1(t.db).execution).toEqual({ state: "running", run_id: "new" });
});

it("projects a failed run that still holds its workspace as failed, never back to the source status", () => {
  addRun(t.db, { id: "r1", status: "failed" });
  addWorktree(t.db, "r1");
  addStep(t.db, { runId: "r1", id: "s1", idx: 0, status: "succeeded", name: "Implement" });
  addStep(t.db, { runId: "r1", id: "s2", idx: 1, status: "stale", name: "Reviewer" });
  addStep(t.db, { runId: "r1", id: "s3", idx: 2, status: "canceled", name: "Verify" });

  const issue = readI1(t.db);
  expect(issue.execution).toEqual({
    state: "failed",
    run_id: "r1",
    failure: { reason: "failed", step: { id: "s2", name: "Reviewer" } },
  });
  expect(issue.status).toBe("backlog");
  expect(issue.workspace).toMatchObject({ state: "open", run_id: "r1" });
});

it("keeps the failure and its step after a restart, from persisted rows alone", () => {
  addRun(t.db, { id: "r1", status: "failed" });
  addWorktree(t.db, "r1");
  addStep(t.db, { runId: "r1", id: "s1", idx: 0, status: "stale", name: "Implement" });

  const reopened = createClient(t.dbPath);
  try {
    expect(readIssue(reopened.db, "i1")?.execution).toEqual({
      state: "failed",
      run_id: "r1",
      failure: { reason: "failed", step: { id: "s1", name: "Implement" } },
    });
  } finally {
    reopened.sqlite.close();
  }
});

it("lets a completed run neutralize the failure of the cycle it replaced, restart included", () => {
  addRun(t.db, { id: "old", status: "failed", createdAt: "2026-01-01 00:00:00" });
  addWorktree(t.db, "old");
  addStep(t.db, { runId: "old", id: "s1", idx: 0, status: "failed", name: "Implement" });
  addRun(t.db, { id: "new", status: "completed", createdAt: "2026-01-02 00:00:00" });

  expect(readI1(t.db).execution).toEqual({ state: "none", run_id: null });
  expect(readRuns(t.db, { issueId: "i1" }).map((run) => [run.id, run.status])).toEqual(
    expect.arrayContaining([["old", "failed"]]),
  );

  const reopened = createClient(t.dbPath);
  try {
    expect(readIssue(reopened.db, "i1")?.execution).toEqual({ state: "none", run_id: null });
  } finally {
    reopened.sqlite.close();
  }
});

it("projects the failure of the last run, not the outcome of the run before it", () => {
  addRun(t.db, { id: "old", status: "completed", createdAt: "2026-01-01 00:00:00" });
  addRun(t.db, { id: "new", status: "failed", createdAt: "2026-01-02 00:00:00" });
  addWorktree(t.db, "new");
  addStep(t.db, { runId: "new", id: "s1", idx: 0, status: "failed", name: "Implement" });

  expect(readI1(t.db).execution).toEqual({
    state: "failed",
    run_id: "new",
    failure: { reason: "failed", step: { id: "s1", name: "Implement" } },
  });
});

it("projects none for an issue with no runs", () => {
  expect(readI1(t.db).execution).toEqual({ state: "none", run_id: null });
});

it("projects execution while leaving a Linear issue's source status intact", () => {
  t.db
    .insert(schema.issues)
    .values({
      id: "lin1",
      project_id: "p1",
      title: "Mirrored",
      status: "backlog",
      source: "linear",
      source_external_id: "EXT-1",
      source_identifier: "OTO-100",
      source_url: "https://linear.app/otomat/issue/OTO-100",
      synced_at: "2026-07-20T10:00:00.000Z",
      source_state_name: "In Review",
      source_state_color: "#facc15",
    })
    .run();
  addRun(t.db, { id: "lr1", status: "review_ready", issueId: "lin1" });

  const issue = readIssue(t.db, "lin1");
  expect(issue?.source).toBe("linear");
  expect(issue?.execution).toEqual({ state: "reviewing", run_id: "lr1" });
  expect(issue?.status).toBe("backlog");
  expect(issue?.source_state_name).toBe("In Review");
});

it("reconstructs the projection from persisted data on a fresh connection", () => {
  addRun(t.db, { id: "r1", status: "review_ready" });

  // A second connection to the same file sees only what is persisted — no in-memory daemon state.
  const reopened = createClient(t.dbPath);
  try {
    expect(readIssue(reopened.db, "i1")?.execution).toEqual({ state: "reviewing", run_id: "r1" });
  } finally {
    reopened.sqlite.close();
  }
});
