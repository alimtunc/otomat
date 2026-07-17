import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getReviewComment,
  insertReviewComment,
  listReviewCommentsForRun,
  setReviewCommentFixRequested,
  updateReviewCommentStatus,
} from "#db/repositories/review-comments";
import { getReviewForRun, insertReview, updateReviewStatus } from "#db/repositories/reviews";

import { createTempDb, seedReviewRun, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-reviews-");
  seedReviewRun(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("round-trips a review and its pin-to-SHA comments for a run", () => {
  const { db } = t.client;
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
