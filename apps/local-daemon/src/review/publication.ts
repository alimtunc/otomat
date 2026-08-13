import { getReviewComment, setReviewCommentPublication, type ReviewCommentRow } from "@otomat/db";
import {
  reviewCommentPublicationMachine,
  type ReviewCommentPublicationState,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { computeDiff } from "./diff.js";
import {
  CommentDestinationUnavailableError,
  CommentPublicationFailedError,
  ReviewAnchorStaleError,
} from "./errors.js";
import { buildCommentPublishedEvent } from "./events.js";
import { reloadOrThrow } from "./reload.js";
import type { ReviewContext } from "./types.js";

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
    `review comment ${comment.id} vanished while publishing`,
  );
}

function assertPublishable(ctx: ReviewContext, comment: ReviewCommentRow, runId: string): void {
  if (comment.destination !== "pr_review") {
    throw new CommentDestinationUnavailableError(
      "This comment is addressed to the agent; publishing it to GitHub is a separate, explicit action.",
    );
  }
  if (comment.publication_status === "published") {
    throw new CommentDestinationUnavailableError("This comment is already published on GitHub.");
  }
  const diff = computeDiff(ctx, runId);
  const file = diff?.files.find((candidate) => candidate.path === comment.file_path);
  if (file === undefined || file.sha !== comment.diff_sha) {
    throw new ReviewAnchorStaleError(comment.file_path);
  }
}

/**
 * Order is the invariant: mark `pending`, call the provider, then persist its
 * answer — a refusal comes back on the returned row, never as a lost attempt.
 */
export async function deliverComment(
  ctx: ReviewContext,
  runId: string,
  comment: ReviewCommentRow,
): Promise<ReviewCommentRow> {
  const pending = drive(ctx, comment, "pending", { publication_error: null });
  let published: { url: string };
  try {
    published = await ctx.publishReviewComment(runId, {
      filePath: pending.file_path,
      side: pending.side,
      startLine: pending.start_line,
      line: pending.line,
      body: pending.body,
      suggestion: pending.suggestion,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return drive(ctx, pending, "failed", { publication_error: reason });
  }

  const settled = drive(ctx, pending, "published", {
    publication_error: null,
    external_url: published.url,
  });
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    runId,
    buildCommentPublishedEvent(runId, settled, new Date().toISOString()),
  );
  return settled;
}

export async function publishComment(
  ctx: ReviewContext,
  runId: string,
  commentId: string,
): Promise<ReviewCommentRow> {
  const comment = reloadOrThrow(
    () => getReviewComment(ctx.db, commentId),
    `review comment ${commentId} not found`,
  );
  assertPublishable(ctx, comment, runId);

  const delivered = await deliverComment(ctx, runId, comment);
  if (delivered.publication_status === "failed") {
    throw new CommentPublicationFailedError(
      delivered.publication_error ?? "GitHub refused the comment.",
    );
  }
  return delivered;
}
