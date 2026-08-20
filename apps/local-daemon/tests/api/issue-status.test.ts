import { createClient, getIssue, getRun, schema, updateIssueStatus } from "@otomat/db";
import type { IssueContract } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, patch } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-issue-status-");
});

afterEach(() => {
  t.cleanup();
});

function seedLinearIssue(): void {
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
    })
    .run();
}

it("marks a local issue ready, then done, and persists each landing", async () => {
  const app = makeApiApp(t);

  const ready = await patch(app, "/api/issues/i1/status", { status: "ready" });
  expect(ready.status).toBe(200);
  expect((await json<IssueContract>(ready)).status).toBe("ready");
  expect(getIssue(t.db, "i1")?.status).toBe("ready");

  const done = await patch(app, "/api/issues/i1/status", { status: "done" });
  expect(done.status).toBe(200);
  expect((await json<IssueContract>(done)).status).toBe("done");
  expect(getIssue(t.db, "i1")?.status).toBe("done");
});

it("still reads the marked status from a fresh connection", async () => {
  await patch(makeApiApp(t), "/api/issues/i1/status", { status: "done" });

  const reopened = createClient(t.dbPath);
  try {
    expect(getIssue(reopened.db, "i1")?.status).toBe("done");
  } finally {
    reopened.sqlite.close();
  }
});

it("reopens a done issue as ready", async () => {
  const app = makeApiApp(t);
  await patch(app, "/api/issues/i1/status", { status: "done" });

  const reopened = await patch(app, "/api/issues/i1/status", { status: "ready" });
  expect(reopened.status).toBe(200);
  expect((await json<IssueContract>(reopened)).status).toBe("ready");
  expect(getIssue(t.db, "i1")?.status).toBe("ready");
});

it("refuses an execution state as a manual status", async () => {
  const app = makeApiApp(t);
  for (const status of ["running", "reviewing", "pr_open"]) {
    const res = await patch(app, "/api/issues/i1/status", { status });
    expect(res.status).toBe(400);
    expect((await json<{ error: string }>(res)).error).toBe("invalid_request");
  }
  expect(getIssue(t.db, "i1")?.status).toBe("backlog");
});

it("refuses a status the issue machine has no edge for", async () => {
  updateIssueStatus(t.db, "i1", "canceled");

  const res = await patch(makeApiApp(t), "/api/issues/i1/status", { status: "ready" });
  expect(res.status).toBe(409);
  expect((await json<{ error: string }>(res)).error).toBe("issue_status_refused");
  expect(getIssue(t.db, "i1")?.status).toBe("canceled");
});

it("refuses a mirrored issue and leaves its status to its tracker", async () => {
  seedLinearIssue();

  const res = await patch(makeApiApp(t), "/api/issues/lin1/status", { status: "done" });
  expect(res.status).toBe(409);
  expect(await json<{ error: string; message: string }>(res)).toEqual({
    error: "issue_not_local",
    message: "A linear issue takes its status from its tracker; set it there instead.",
  });
  expect(getIssue(t.db, "lin1")?.status).toBe("backlog");
});

it("answers 404 for an issue that no longer exists", async () => {
  const res = await patch(makeApiApp(t), "/api/issues/ghost/status", { status: "done" });
  expect(res.status).toBe(404);
  expect((await json<{ error: string }>(res)).error).toBe("issue_not_found");
});

it("leaves a live run alone, so its execution still reads over the closed status", async () => {
  t.db
    .insert(schema.worktrees)
    .values({
      id: "wt1",
      repository_id: seedRepository(t.db),
      path: "/tmp/r1",
      branch: "otomat/run/r1",
      head_sha: "",
      base_sha: "",
      base_ref: "main",
      owner_token: "r1",
      status: "active",
    })
    .run();
  t.db
    .insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "i1",
      status: "running",
      branch: "otomat/run/r1",
      worktree_id: "wt1",
      plan_json: { version: 1, steps: [] },
    })
    .run();

  const res = await patch(makeApiApp(t), "/api/issues/i1/status", { status: "done" });
  const issue = await json<IssueContract>(res);

  expect(issue.status).toBe("done");
  expect(issue.execution).toEqual({ state: "running", run_id: "r1" });
  expect(issue.workspace).toMatchObject({ state: "open", run_id: "r1" });
  expect(getRun(t.db, "r1")?.status).toBe("running");
});
