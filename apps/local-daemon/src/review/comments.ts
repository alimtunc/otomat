import { randomUUID } from "node:crypto";

import {
  getReviewComment,
  getReviewForRun,
  insertReview,
  insertReviewComment,
  listReviewCommentsForRun,
  type ReviewCommentRow,
  type ReviewRow,
} from "@otomat/db";
import {
  reviewCommentMachine,
  reviewMachine,
  type CreateReviewCommentRequest,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { computeDiff, driveReviewTo, reloadOrThrow, type ReviewContext } from "./context.js";
import { DiffUnavailableError, ReviewAnchorStaleError } from "./errors.js";
import { buildCommentCreatedEvent } from "./events.js";
import { extractHunkForLine } from "./hunks.js";
import type { ReviewDetailResult } from "./types.js";

/** Returns the run's review row, creating it (status `open`) on the first comment. */
function ensureReview(ctx: ReviewContext, runId: string): ReviewRow {
  const existing = getReviewForRun(ctx.db, runId);
  if (existing) return existing;
  const id = randomUUID();
  insertReview(ctx.db, { id, run_id: runId, status: reviewMachine.initial });
  return reloadOrThrow(
    () => getReviewForRun(ctx.db, runId),
    `review ${id} vanished immediately after insert`,
  );
}

/** The run's review row (null until the first comment creates it) and all its comments. */
export function getReviewDetail(ctx: ReviewContext, runId: string): ReviewDetailResult {
  return {
    review: getReviewForRun(ctx.db, runId) ?? null,
    comments: listReviewCommentsForRun(ctx.db, runId),
  };
}

/**
 * Pins a comment to the live diff: the request's `diff_sha` must still match the
 * file's current `DiffFile.sha`. Captures the covering hunk (or the whole patch) as
 * `hunk_snapshot`, creates the review on the first comment, drives it to `in_review`,
 * and emits `review.comment_created`. Throws DiffUnavailableError when the run has no
 * worktree diff, and ReviewAnchorStaleError when the path/sha no longer matches.
 */
export function addComment(
  ctx: ReviewContext,
  runId: string,
  request: CreateReviewCommentRequest,
): ReviewCommentRow {
  const diff = computeDiff(ctx, runId);
  if (diff === null) throw new DiffUnavailableError(runId);
  const file = diff.files.find(
    (candidate) => candidate.path === request.file_path && candidate.sha === request.diff_sha,
  );
  if (!file) throw new ReviewAnchorStaleError(request.file_path);

  const now = new Date().toISOString();
  const review = ensureReview(ctx, runId);
  const id = randomUUID();
  insertReviewComment(ctx.db, {
    id,
    review_id: review.id,
    file_path: request.file_path,
    line: request.line,
    diff_sha: request.diff_sha,
    body: request.body,
    status: reviewCommentMachine.initial,
    hunk_snapshot: extractHunkForLine(file.patch, request.line) ?? file.patch,
  });
  if (review.status !== "in_review") driveReviewTo(ctx, review, "in_review");

  const created = reloadOrThrow(
    () => getReviewComment(ctx.db, id),
    `review comment ${id} vanished immediately after insert`,
  );
  emitLedgerEvent(ctx.db, ctx.dataDir, runId, buildCommentCreatedEvent(runId, created, now));
  return created;
}
