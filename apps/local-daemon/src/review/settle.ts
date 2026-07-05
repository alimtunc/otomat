import {
  getReviewForRun,
  getRun,
  listReviewCommentsForRun,
  setReviewCommentFixRequested,
  updateReviewCommentStatus,
  type ReviewCommentRow,
} from "@otomat/db";
import { reviewCommentMachine } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import type { CanonicalDiff } from "#git";

import { computeDiff, driveReviewTo, type ReviewContext } from "./context.js";
import {
  buildCommentResolvedEvent,
  buildDiffUpdatedEvent,
  type CommentResolution,
} from "./events.js";
import type { RunSettledOutcome } from "./types.js";

function resolveComment(
  ctx: ReviewContext,
  runId: string,
  comment: ReviewCommentRow,
  resolution: CommentResolution,
  now: string,
): void {
  updateReviewCommentStatus(
    ctx.db,
    comment.id,
    reviewCommentMachine.transition(comment.status, resolution),
  );
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    runId,
    buildCommentResolvedEvent(runId, comment.id, resolution, now),
  );
}

/** The turn did not finish: drop pending fix requests so the reviewer can retry. */
function releasePendingFixes(ctx: ReviewContext, open: ReviewCommentRow[]): void {
  for (const comment of open) {
    if (comment.fix_requested_at !== null) setReviewCommentFixRequested(ctx.db, comment.id, null);
  }
}

function resolveSettledComments(
  ctx: ReviewContext,
  runId: string,
  open: ReviewCommentRow[],
  diff: CanonicalDiff | null,
  now: string,
): void {
  const fileShas = new Map(diff?.files.map((file) => [file.path, file.sha]) ?? []);
  for (const comment of open) {
    if (comment.fix_requested_at !== null) {
      resolveComment(ctx, runId, comment, "addressed", now);
    } else if (diff !== null && fileShas.get(comment.file_path) !== comment.diff_sha) {
      // The diff moved under an unaddressed anchor; never migrate it live.
      resolveComment(ctx, runId, comment, "outdated", now);
    }
  }
}

function deriveReviewStatus(ctx: ReviewContext, runId: string): void {
  const review = getReviewForRun(ctx.db, runId);
  if (!review || review.status === "open") return;
  const stillOpen = listReviewCommentsForRun(ctx.db, runId).some(
    (comment) => comment.status === "open",
  );
  if (!stillOpen) {
    if (review.status !== "resolved") driveReviewTo(ctx, review, "resolved");
  } else if (review.status === "changes_requested") {
    driveReviewTo(ctx, review, "in_review");
  }
}

/** After a turn settles: refresh the diff projection, resolve anchors, converge the review. */
export function onRunSettled(ctx: ReviewContext, outcome: RunSettledOutcome): void {
  const run = getRun(ctx.db, outcome.runId);
  if (!run) return;
  const now = new Date().toISOString();
  const open = listReviewCommentsForRun(ctx.db, run.id).filter(
    (comment) => comment.status === "open",
  );

  if (outcome.classification !== "completed") {
    releasePendingFixes(ctx, open);
    return;
  }

  const diff = computeDiff(ctx, run.id);
  if (diff !== null) {
    emitLedgerEvent(ctx.db, ctx.dataDir, run.id, buildDiffUpdatedEvent(run.id, diff, now));
  }
  resolveSettledComments(ctx, run.id, open, diff, now);
  deriveReviewStatus(ctx, run.id);
}
