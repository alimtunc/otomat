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
  reviewCommentPublicationMachine,
  reviewMachine,
  type CreateReviewCommentRequest,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { captureAnchor } from "./anchor.js";
import { getFixAuthority } from "./authority.js";
import { getDestinationAvailability } from "./destinations.js";
import { computeDiff } from "./diff.js";
import {
  CommentDestinationUnavailableError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
} from "./errors.js";
import { buildCommentCreatedEvent } from "./events.js";
import { deliverComment } from "./publication.js";
import { reloadOrThrow } from "./reload.js";
import { driveReviewTo } from "./transitions.js";
import type { ReviewContext, ReviewDetailResult } from "./types.js";

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

export function getReviewDetail(ctx: ReviewContext, runId: string): ReviewDetailResult {
  return {
    review: getReviewForRun(ctx.db, runId) ?? null,
    comments: listReviewCommentsForRun(ctx.db, runId),
    fixAuthority: getFixAuthority(ctx, runId),
    destinations: getDestinationAvailability(ctx, runId),
  };
}

export async function addComment(
  ctx: ReviewContext,
  runId: string,
  request: CreateReviewCommentRequest,
): Promise<ReviewCommentRow> {
  const diff = computeDiff(ctx, runId);
  if (diff === null) throw new DiffUnavailableError(runId);
  const file = diff.files.find(
    (candidate) => candidate.path === request.file_path && candidate.sha === request.diff_sha,
  );
  if (!file) throw new ReviewAnchorStaleError(request.file_path);

  const destinations = getDestinationAvailability(ctx, runId);
  if (request.destination === "pr_review" && !destinations.pr_review) {
    throw new CommentDestinationUnavailableError(destinations.reason);
  }
  const anchor = captureAnchor(file.patch, request);

  const now = new Date().toISOString();
  const review = ensureReview(ctx, runId);
  const id = randomUUID();
  insertReviewComment(ctx.db, {
    id,
    review_id: review.id,
    file_path: request.file_path,
    side: request.side,
    start_line: anchor.startLine,
    line: anchor.line,
    diff_sha: request.diff_sha,
    body: request.body,
    status: reviewCommentMachine.initial,
    destination: request.destination,
    publication_status: reviewCommentPublicationMachine.initial,
    suggestion: anchor.suggestion,
    suggestion_original: anchor.suggestionOriginal,
    hunk_snapshot: anchor.hunkSnapshot,
  });
  if (review.status !== "in_review") driveReviewTo(ctx, review, "in_review");

  const created = reloadOrThrow(
    () => getReviewComment(ctx.db, id),
    `review comment ${id} vanished immediately after insert`,
  );
  emitLedgerEvent(ctx.db, ctx.dataDir, runId, buildCommentCreatedEvent(runId, created, now));
  if (created.destination !== "pr_review") return created;
  return deliverComment(ctx, runId, created);
}
