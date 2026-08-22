import {
  insertPullRequest,
  schema,
  updatePullRequest,
  writeGitHubViewer,
  type Db,
} from "@otomat/db";
import type { InboxSnapshot } from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

/** A second project on the same host: the Inbox is cross-project, so a snapshot scoped to one is wrong. */
function seedOtherProject(db: Db): void {
  db.insert(schema.projects).values({ id: "p2", name: "Other", root_path: "/tmp/other" }).run();
  db.insert(schema.issues)
    .values({ id: "i2", project_id: "p2", title: "Second", source_identifier: "ABC-2" })
    .run();
}

async function readInboxSnapshot(): Promise<InboxSnapshot> {
  const response = await request(makeApiApp(t), "/api/inbox");
  expect(response.status).toBe(200);
  return json<InboxSnapshot>(response);
}

beforeEach(() => {
  t = setupTestDb("otomat-inbox-");
});

afterEach(() => {
  t.cleanup();
});

describe("GET /api/inbox", () => {
  it("reports a blocked run with the project and the step that stopped it", async () => {
    seedRun(t.db, {
      runId: "run-blocked",
      runStatus: "awaiting_human",
      stepStatus: "awaiting_human",
      sessionStatus: "awaiting_input",
    });

    const snapshot = await readInboxSnapshot();

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      kind: "run_awaiting_answer",
      state: "open",
      project: { id: "p1", name: "P" },
      target: { kind: "run", run_id: "run-blocked" },
    });
    expect(snapshot.observed_at).toEqual(expect.any(String));
  });

  it("aggregates every project the host holds", async () => {
    seedOtherProject(t.db);
    seedRun(t.db, {
      runId: "run-p1",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "terminated",
    });
    seedRun(t.db, {
      runId: "run-p2",
      issueId: "i2",
      repositoryId: null,
      runStatus: "awaiting_permission",
      stepStatus: "awaiting_permission",
      sessionStatus: "active",
    });

    const snapshot = await readInboxSnapshot();

    expect(snapshot.entries.map((entry) => entry.project.id).toSorted()).toEqual(["p1", "p2"]);
  });

  it("reports a stopped publication instead of the review its run was waiting for", async () => {
    seedRun(t.db, {
      runId: "run-published",
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    insertPullRequest(t.db, {
      id: "pr-1",
      issue_id: "i1",
      run_id: "run-published",
      publication_status: "pushing",
      title: "feat: ship it",
    });
    updatePullRequest(t.db, "pr-1", {
      publication_status: "failed",
      failed_phase: "pushing",
      error_code: "github_push_failed",
      error_message: "The branch was rejected.",
    });

    const snapshot = await readInboxSnapshot();

    expect(snapshot.entries.map((entry) => entry.kind)).toEqual(["publication_stopped"]);
    expect(snapshot.entries[0]).toMatchObject({
      detail: "The branch was rejected.",
      target: { kind: "run_pull_request", run_id: "run-published" },
    });
  });

  it("reports a pull request whose review the viewer owes", async () => {
    seedRepository(t.db);
    writeGitHubViewer(t.db, { login: "operator", teams: [] });
    insertPullRequest(t.db, {
      id: "pr-2",
      repository_id: "repo-1",
      number: 7,
      url: "https://github.com/acme/repo/pull/7",
      status: "open",
      author_login: "someone",
      review_decision: "review_required",
      requested_reviewers: [{ kind: "user", handle: "operator" }],
      title: "feat: adopt it",
    });

    const snapshot = await readInboxSnapshot();

    expect(snapshot.entries).toEqual([
      expect.objectContaining({
        kind: "pull_request_review_requested",
        subject: { title: "feat: adopt it", identifier: null },
        target: { kind: "pull_request", pull_request_id: "pr-2" },
      }),
    ]);
  });

  it("asks nothing for a pull request GitHub already settled", async () => {
    seedRepository(t.db);
    writeGitHubViewer(t.db, { login: "operator", teams: [] });
    insertPullRequest(t.db, {
      id: "pr-3",
      repository_id: "repo-1",
      number: 8,
      url: "https://github.com/acme/repo/pull/8",
      status: "merged",
      author_login: "someone",
      review_decision: "review_required",
      requested_reviewers: [{ kind: "user", handle: "operator" }],
      title: "feat: already merged",
    });

    expect((await readInboxSnapshot()).entries).toEqual([]);
  });

  it("asks nothing once the cause is gone", async () => {
    seedRun(t.db, {
      runId: "run-running",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });

    expect((await readInboxSnapshot()).entries).toEqual([]);
  });
});
