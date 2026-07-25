import { createClient, schema, type Db } from "@otomat/db";
import type { PullRequestPublicationState, PullRequestState, RunState } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readIssue, readIssues } from "#api/reads";

import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-issue-exec-");
});

afterEach(() => {
  t.cleanup();
});

function addRun(
  db: Db,
  run: { id: string; status: RunState; issueId?: string; createdAt?: string },
): void {
  const at = run.createdAt ?? "2026-01-01T00:00:00.000Z";
  db.insert(schema.runs)
    .values({
      id: run.id,
      issue_id: run.issueId ?? "i1",
      status: run.status,
      branch: `otomat/${run.id}`,
      plan_json: { version: 1, steps: [] },
      created_at: at,
      updated_at: at,
    })
    .run();
}

function addPullRequest(
  db: Db,
  pr: {
    id: string;
    runId: string;
    status: PullRequestState;
    publication: PullRequestPublicationState;
  },
): void {
  db.insert(schema.pullRequests)
    .values({
      id: pr.id,
      run_id: pr.runId,
      status: pr.status,
      publication_status: pr.publication,
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
  // and the same via the list read
  const listed = readIssues(t.db, "p1").find((entry) => entry.id === "i1");
  expect(listed?.execution).toEqual({ state: "running", run_id: "r1" });
});

it("surfaces a review_ready run as reviewing", () => {
  addRun(t.db, { id: "r1", status: "review_ready" });
  expect(readI1(t.db).execution).toEqual({ state: "reviewing", run_id: "r1" });
});

it("surfaces a really-created, open pull request as pr_open", () => {
  addRun(t.db, { id: "r1", status: "completed" });
  addPullRequest(t.db, { id: "pr1", runId: "r1", status: "open", publication: "created" });
  expect(readI1(t.db).execution).toEqual({ state: "pr_open", run_id: "r1" });
});

it("does not treat a merged or not-yet-created PR as open", () => {
  addRun(t.db, { id: "r1", status: "completed" });
  addPullRequest(t.db, { id: "pr1", runId: "r1", status: "merged", publication: "created" });
  addRun(t.db, { id: "r2", status: "completed" });
  addPullRequest(t.db, { id: "pr2", runId: "r2", status: "open", publication: "creating" });
  expect(readI1(t.db).execution).toEqual({ state: "none", run_id: null });
});

it("keeps live work ahead of an older terminal run with an open PR", () => {
  addRun(t.db, { id: "old", status: "completed", createdAt: "2026-01-01T00:00:00.000Z" });
  addPullRequest(t.db, { id: "pr1", runId: "old", status: "open", publication: "created" });
  addRun(t.db, { id: "new", status: "running", createdAt: "2026-01-02T00:00:00.000Z" });
  expect(readI1(t.db).execution).toEqual({ state: "running", run_id: "new" });
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
