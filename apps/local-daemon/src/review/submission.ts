import { getReviewComment, setReviewCommentPublication, type ReviewCommentRow } from "@otomat/db";
import {
  isPendingReviewComment,
  reviewCommentPublicationMachine,
  type ReviewCommentPublicationState,
  type SubmitReviewRequest,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { computeDiff } from "./diff.js";
import {
  ReviewAnchorStaleError,
  ReviewSubmissionBusyError,
  ReviewSubmissionEmptyError,
  ReviewSubmissionFailedError,
  ReviewSubmissionUnavailableError,
} from "./errors.js";
import { buildCommentPublishedEvent } from "./events.js";
import { reviewAnchorSha } from "./pull-request.js";
import { reloadOrThrow } from "./reload.js";
import { ensureReview, getReviewDetail } from "./surface.js";
import { driveReviewTo } from "./transitions.js";
import type {
  PullRequestCommentInput,
  ReviewContext,
  ReviewDetailResult,
  ReviewSubject,
} from "./types.js";

/** Keyed by pull request: two surfaces can reach one GitHub review, and a retry must not post it twice. */
const inFlight = new Set<string>();

const REVIEW_OUTCOME = {
  comment: "in_review",
  request_changes: "changes_requested",
  approve: "resolved",
} as const;

function drive(
  ctx: ReviewContext,
  comment: ReviewCommentRow,
  to: ReviewCommentPublicationState,
  patch: { publication_error?: string | null; external_url?: string | null } = {},
): ReviewCommentRow {
  setReviewCommentPublication(ctx.db, comment.id, {
    publication_status: reviewCommentPublicationMachine.transition(comment.publication_status, to),
    ...patch,
  });
  return reloadOrThrow(
    () => getReviewComment(ctx.db, comment.id),
    `review comment ${comment.id} vanished while submitting`,
  );
}

/** A comment whose file moved would make GitHub refuse the whole review, so it is refused here by name. */
function assertAnchored(subject: ReviewSubject, comments: readonly ReviewCommentRow[]): void {
  const diff = computeDiff(subject);
  for (const comment of comments) {
    const file = diff?.files.find((candidate) => candidate.path === comment.file_path);
    if (file === undefined || file.sha !== comment.diff_sha) {
      throw new ReviewAnchorStaleError(comment.file_path);
    }
  }
}

function toCommentInput(comment: ReviewCommentRow): PullRequestCommentInput {
  return {
    filePath: comment.file_path,
    side: comment.side,
    startLine: comment.start_line,
    line: comment.line,
    body: comment.body,
    suggestion: comment.suggestion,
  };
}

/** Order is the invariant: mark pending, call the provider once, then persist its single answer. */
async function deliver(
  ctx: ReviewContext,
  subject: ReviewSubject,
  pullRequestId: string,
  commitSha: string,
  pending: readonly ReviewCommentRow[],
  request: SubmitReviewRequest,
): Promise<void> {
  const marked = pending.map((comment) =>
    comment.publication_status === "pending"
      ? comment
      : drive(ctx, comment, "pending", { publication_error: null }),
  );
  let published: { url: string };
  try {
    published = await ctx.submitPullRequestReview(pullRequestId, {
      commitSha,
      body: request.body,
      event: request.event,
      comments: marked.map(toCommentInput),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    for (const comment of marked) drive(ctx, comment, "failed", { publication_error: reason });
    throw new ReviewSubmissionFailedError(reason);
  }

  const settled = marked.map((comment) =>
    drive(ctx, comment, "published", { publication_error: null, external_url: published.url }),
  );
  const settledAt = new Date().toISOString();
  if (subject.ledgerRunId !== null) {
    for (const comment of settled) {
      emitLedgerEvent(
        ctx.db,
        ctx.dataDir,
        subject.ledgerRunId,
        buildCommentPublishedEvent(subject.ledgerRunId, comment, settledAt),
      );
    }
  }
  driveReviewTo(ctx, ensureReview(ctx, subject.id), REVIEW_OUTCOME[request.event]);
}

export async function submitReview(
  ctx: ReviewContext,
  subject: ReviewSubject,
  request: SubmitReviewRequest,
): Promise<ReviewDetailResult> {
  const pullRequest = subject.pullRequest();
  const { submission, comments } = getReviewDetail(ctx, subject);
  if (pullRequest === null || !submission.events.includes(request.event)) {
    throw new ReviewSubmissionUnavailableError(submission.reason);
  }
  const commitSha = reviewAnchorSha(pullRequest);
  if (commitSha === null) {
    throw new ReviewSubmissionUnavailableError(
      "This pull request has no head commit to anchor a review on.",
    );
  }

  const pending = comments.filter(isPendingReviewComment);
  if (request.body.trim() === "" && pending.length === 0) {
    throw new ReviewSubmissionEmptyError(
      "Write a summary or leave a comment on the diff before submitting.",
    );
  }
  assertAnchored(subject, pending);

  if (inFlight.has(pullRequest.id)) {
    throw new ReviewSubmissionBusyError("This review is already being submitted.");
  }
  inFlight.add(pullRequest.id);
  try {
    await deliver(ctx, subject, pullRequest.id, commitSha, pending, request);
  } finally {
    inFlight.delete(pullRequest.id);
  }
  return getReviewDetail(ctx, subject);
}
