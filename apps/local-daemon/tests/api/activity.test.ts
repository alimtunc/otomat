import { insertPullRequest, schema, updatePullRequest, type Db } from "@otomat/db";
import type { ActivitySnapshot } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

/** A second project on the same host: the header is cross-project, so the snapshot must not be scoped to one. */
function seedOtherProject(db: Db): void {
  db.insert(schema.projects).values({ id: "p2", name: "Other", root_path: "/tmp/other" }).run();
  db.insert(schema.issues)
    .values({ id: "i2", project_id: "p2", title: "Second", source_identifier: "ABC-2" })
    .run();
}

async function readActivitySnapshot(): Promise<ActivitySnapshot> {
  const response = await request(makeApiApp(t), "/api/activity");
  expect(response.status).toBe(200);
  return json<ActivitySnapshot>(response);
}

beforeEach(() => {
  t = setupTestDb("otomat-activity-");
});

afterEach(() => {
  t.cleanup();
});

describe("GET /api/activity", () => {
  it("reports a working run with the step it is on and the project it belongs to", async () => {
    seedRun(t.db, {
      runId: "run-live",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities).toHaveLength(1);
    expect(snapshot.activities[0]).toMatchObject({
      kind: "run",
      bucket: "running",
      run_id: "run-live",
      project: { id: "p1", name: "P" },
    });
    expect(snapshot.observed_at).toEqual(expect.any(String));
  });

  it("covers every project the host holds", async () => {
    seedOtherProject(t.db);
    seedRun(t.db, {
      runId: "run-p1",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });
    seedRun(t.db, {
      runId: "run-p2",
      issueId: "i2",
      repositoryId: null,
      runStatus: "awaiting_human",
      stepStatus: "awaiting_human",
      sessionStatus: "awaiting_input",
    });

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities.map((activity) => activity.project.id).toSorted()).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("carries a publication that outlives its run as its own activity", async () => {
    seedRun(t.db, {
      runId: "run-published",
      runStatus: "completed",
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

    const snapshot = await readActivitySnapshot();
    const publication = snapshot.activities.find(
      (activity) => activity.kind === "pull_request_publication",
    );

    expect(publication).toMatchObject({
      bucket: "running",
      phase: "Pushing the branch",
      run_id: "run-published",
    });
  });

  it("surfaces a failed publication with the reason the daemon recorded", async () => {
    seedRun(t.db, {
      runId: "run-failed-pr",
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    insertPullRequest(t.db, {
      id: "pr-2",
      issue_id: "i1",
      run_id: "run-failed-pr",
      publication_status: "pushing",
      title: "feat: ship it",
    });
    updatePullRequest(t.db, "pr-2", {
      publication_status: "failed",
      failed_phase: "pushing",
      error_code: "github_push_failed",
      error_message: "The commits could not be pushed to GitHub.",
    });

    const snapshot = await readActivitySnapshot();
    const publication = snapshot.activities.find(
      (activity) => activity.kind === "pull_request_publication",
    );

    expect(publication).toMatchObject({ bucket: "attention", phase: "Pushing the branch" });
    expect(publication?.kind === "pull_request_publication" && publication.operation.error).toEqual(
      {
        code: "github_push_failed",
        message: "The commits could not be pushed to GitHub.",
      },
    );
  });

  it("drops a run that settled long ago and keeps one that is still stopped", async () => {
    seedRun(t.db, {
      runId: "run-old",
      runStatus: "running",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    seedRun(t.db, {
      runId: "run-stopped",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    t.db
      .update(schema.runs)
      .set({
        status: "completed",
        created_at: "2020-01-01 00:00:00",
        updated_at: "2020-01-01 00:00:00",
      })
      .where(eq(schema.runs.id, "run-old"))
      .run();
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-02 00:00:00" })
      .where(eq(schema.runs.id, "run-stopped"))
      .run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities.map((activity) => activity.run_id)).toEqual(["run-stopped"]);
  });

  it("keeps a failed run of any age until the operator abandons it", async () => {
    seedRun(t.db, {
      runId: "run-old-failed",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    seedRun(t.db, {
      runId: "run-old-abandoned",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-02 00:00:00", updated_at: "2020-01-01 00:00:00" })
      .where(eq(schema.runs.id, "run-old-failed"))
      .run();
    t.db
      .update(schema.runs)
      .set({
        created_at: "2020-01-01 00:00:00",
        updated_at: "2020-01-01 00:00:00",
        abandoned_at: "2020-01-02 00:00:00",
      })
      .where(eq(schema.runs.id, "run-old-abandoned"))
      .run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities.map((activity) => activity.run_id)).toEqual(["run-old-failed"]);
  });

  it("drops the failures of an issue the operator closed", async () => {
    seedRun(t.db, {
      runId: "run-closed",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    t.db.update(schema.issues).set({ status: "done" }).where(eq(schema.issues.id, "i1")).run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities).toEqual([]);
  });

  it("drops a failure a newer run replaced, even one that succeeded outside the window", async () => {
    seedRun(t.db, {
      runId: "run-older",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    seedRun(t.db, {
      runId: "run-newer",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-01 00:00:00" })
      .where(eq(schema.runs.id, "run-older"))
      .run();
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-02 00:00:00", updated_at: "2020-01-03 00:00:00" })
      .where(eq(schema.runs.id, "run-newer"))
      .run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities).toEqual([]);
  });

  it("lets the open run outrank the abandoned one it was created alongside", async () => {
    seedRun(t.db, {
      runId: "run-stale-abandoned",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    seedRun(t.db, {
      runId: "run-live-retry",
      runStatus: "failed",
      stepStatus: "failed",
      sessionStatus: "failed",
    });
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-01 00:00:00", abandoned_at: "2020-01-01 00:00:01" })
      .where(eq(schema.runs.id, "run-stale-abandoned"))
      .run();
    t.db
      .update(schema.runs)
      .set({ created_at: "2020-01-01 00:00:00" })
      .where(eq(schema.runs.id, "run-live-retry"))
      .run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities.map((activity) => activity.run_id)).toEqual(["run-live-retry"]);
  });

  it("keeps a stopped publication whose run settled long ago", async () => {
    seedRun(t.db, {
      runId: "run-old-pr",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    insertPullRequest(t.db, {
      id: "pr-old",
      issue_id: "i1",
      run_id: "run-old-pr",
      publication_status: "pushing",
      title: "feat: ship it",
    });
    updatePullRequest(t.db, "pr-old", {
      publication_status: "failed",
      failed_phase: "pushing",
      error_code: "github_push_failed",
      error_message: "The commits could not be pushed to GitHub.",
    });
    t.db
      .update(schema.runs)
      .set({ updated_at: "2020-01-01 00:00:00" })
      .where(eq(schema.runs.id, "run-old-pr"))
      .run();
    t.db
      .update(schema.pullRequests)
      .set({ updated_at: "2020-01-01 00:00:00" })
      .where(eq(schema.pullRequests.id, "pr-old"))
      .run();

    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities.map((activity) => [activity.kind, activity.bucket])).toContainEqual([
      "pull_request_publication",
      "attention",
    ]);
  });

  it("answers with nothing when the host has done nothing", async () => {
    const snapshot = await readActivitySnapshot();

    expect(snapshot.activities).toEqual([]);
  });
});
