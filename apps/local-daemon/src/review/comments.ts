import { randomUUID } from "node:crypto";

import { getReviewComment, insertReviewComment, type ReviewCommentRow } from "@otomat/db";
import {
  reviewCommentMachine,
  reviewCommentPublicationMachine,
  type CreateReviewCommentRequest,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { captureAnchor } from "./anchor.js";
import { computeDiff } from "./diff.js";
import {
  CommentDestinationUnavailableError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
} from "./errors.js";
import { buildCommentCreatedEvent } from "./events.js";
import { deliverComment } from "./publication.js";
import { reloadOrThrow } from "./reload.js";
import { ensureReview } from "./surface.js";
import { driveReviewTo } from "./transitions.js";
import type { ReviewContext, ReviewSubject } from "./types.js";

export async function addComment(
  ctx: ReviewContext,
  subject: ReviewSubject,
  request: CreateReviewCommentRequest,
): Promise<ReviewCommentRow> {
  const diff = computeDiff(subject);
  if (diff === null) throw new DiffUnavailableError(subject.id);
  const file = diff.files.find(
    (candidate) => candidate.path === request.file_path && candidate.sha === request.diff_sha,
  );
  if (!file) throw new ReviewAnchorStaleError(request.file_path);

  const destinations = subject.destinations();
  if (request.destination === "pr_review" && !destinations.pr_review) {
    throw new CommentDestinationUnavailableError(destinations.reason);
  }
  const anchor = captureAnchor(file.patch, request);

  const now = new Date().toISOString();
  const review = ensureReview(ctx, subject.id);
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
  const ledgerRunId = subject.ledgerRunId;
  if (ledgerRunId !== null) {
    emitLedgerEvent(
      ctx.db,
      ctx.dataDir,
      ledgerRunId,
      buildCommentCreatedEvent(ledgerRunId, created, now),
    );
  }
  if (created.destination !== "pr_review") return created;
  return deliverComment(ctx, subject, created);
}
