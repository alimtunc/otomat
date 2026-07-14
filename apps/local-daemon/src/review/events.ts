import type { ReviewCommentRow } from "@otomat/db";
import type { EventSource, EventType } from "@otomat/domain";

import type { CanonicalDiff } from "#git";
import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

/** Identifies the review module as the event emitter — control-plane facts, never provider output. */
export const REVIEW_ADAPTER = "otomat-review";

/** A comment leaves `open` for one of these reasons; carried on `review.comment_resolved`. */
export type CommentResolution = "addressed" | "outdated";

function buildEvent(
  runId: string,
  type: EventType,
  source: EventSource,
  occurredAt: string,
  payload: Record<string, unknown>,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId,
    kind: type,
    type,
    source,
    adapter: REVIEW_ADAPTER,
    occurredAt,
    payload,
  });
}

export function buildDiffUpdatedEvent(
  runId: string,
  diff: CanonicalDiff,
  occurredAt: string,
): RuntimeEvent {
  return buildEvent(runId, "git.diff_updated", "git", occurredAt, {
    sha: diff.sha,
    base: diff.base,
    additions: diff.additions,
    deletions: diff.deletions,
    file_count: diff.files.length,
  });
}

export function buildCommentCreatedEvent(
  runId: string,
  comment: ReviewCommentRow,
  occurredAt: string,
): RuntimeEvent {
  return buildEvent(runId, "review.comment_created", "otomat", occurredAt, {
    comment_id: comment.id,
    review_id: comment.review_id,
    file_path: comment.file_path,
    line: comment.line,
    diff_sha: comment.diff_sha,
  });
}

export function buildCommentResolvedEvent(
  runId: string,
  commentId: string,
  resolution: CommentResolution,
  occurredAt: string,
): RuntimeEvent {
  return buildEvent(runId, "review.comment_resolved", "otomat", occurredAt, {
    comment_id: commentId,
    resolution,
  });
}
