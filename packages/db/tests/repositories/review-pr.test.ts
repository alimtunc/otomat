import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { createClient, type DbClient } from "#db/client";
import { schema } from "#db/index";
import { runMigrations } from "#db/migrate";
import {
  getPullRequestForRun,
  insertPullRequest,
  updatePullRequestDraft,
  updatePullRequestStatus,
} from "#db/repositories/pull-requests";
import {
  getReviewComment,
  insertReviewComment,
  listReviewCommentsForReview,
  listReviewCommentsForRun,
  setReviewCommentFixRequested,
  updateReviewCommentStatus,
} from "#db/repositories/review-comments";
import { getReviewForRun, insertReview, updateReviewStatus } from "#db/repositories/reviews";

let dbPath = "";
let client: DbClient;

beforeEach(() => {
  dbPath = join(tmpdir(), `otomat-review-${process.pid}-${process.hrtime.bigint()}.db`);
  runMigrations(dbPath);
  client = createClient(dbPath);
  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: "/tmp/p" }).run();
  client.db
    .insert(schema.issues)
    .values({ id: "i1", project_id: "p1", title: "Issue", status: "ready" })
    .run();
  client.db
    .insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "i1",
      status: "review_ready",
      branch: "otomat/run/r1",
      plan_json: { version: 1, steps: [] },
    })
    .run();
});

afterEach(() => {
  client.sqlite.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

it("round-trips a review and its pin-to-SHA comments for a run", () => {
  const { db } = client;
  insertReview(db, { id: "rv1", run_id: "r1", status: "open" });
  expect(getReviewForRun(db, "r1")?.status).toBe("open");

  insertReviewComment(db, {
    id: "c1",
    review_id: "rv1",
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this variable.",
    status: "open",
    hunk_snapshot: "@@ -10,3 +10,4 @@\n+const thing = 1;",
  });

  const comment = getReviewComment(db, "c1");
  expect(comment).toMatchObject({
    file_path: "src/thing.ts",
    line: 12,
    diff_sha: "sha-1",
    status: "open",
    fix_requested_at: null,
  });
  expect(comment?.hunk_snapshot).toContain("@@");

  expect(listReviewCommentsForReview(db, "rv1").map((c) => c.id)).toEqual(["c1"]);
  expect(listReviewCommentsForRun(db, "r1").map((c) => c.id)).toEqual(["c1"]);

  setReviewCommentFixRequested(db, "c1", "2026-07-05T00:00:00.000Z");
  expect(getReviewComment(db, "c1")?.fix_requested_at).toBe("2026-07-05T00:00:00.000Z");
  setReviewCommentFixRequested(db, "c1", null);
  expect(getReviewComment(db, "c1")?.fix_requested_at).toBeNull();

  updateReviewCommentStatus(db, "c1", "outdated");
  expect(getReviewComment(db, "c1")?.status).toBe("outdated");

  updateReviewStatus(db, "rv1", "in_review");
  expect(getReviewForRun(db, "r1")?.status).toBe("in_review");
});

it("stores the local PR draft and updates it in place", () => {
  const { db } = client;
  insertPullRequest(db, {
    id: "pr1",
    run_id: "r1",
    provider: "github",
    status: "draft",
    title: "First slice",
    body: null,
  });

  const created = getPullRequestForRun(db, "r1");
  expect(created).toMatchObject({
    id: "pr1",
    status: "draft",
    provider: "github",
    title: "First slice",
    body: null,
    number: null,
    url: null,
  });

  updatePullRequestDraft(db, "pr1", { title: "First slice, retitled", body: "Adds the loop." });
  expect(getPullRequestForRun(db, "r1")).toMatchObject({
    title: "First slice, retitled",
    body: "Adds the loop.",
    status: "draft",
  });

  updatePullRequestStatus(db, "pr1", "open");
  expect(getPullRequestForRun(db, "r1")?.status).toBe("open");
});
