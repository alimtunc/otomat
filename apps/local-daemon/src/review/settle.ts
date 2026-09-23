import {
  getReviewForSubject,
  getRun,
  listReviewCommentsForSubject,
  setReviewCommentFixedBy,
  setReviewCommentFixRequested,
  updateReviewCommentStatus,
  type ReviewCommentRow,
} from "@otomat/db";
import { reviewCommentMachine } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import type { CanonicalDiff } from "#git";

import { computeDiff } from "./diff.js";
import {
  buildCommentResolvedEvent,
  buildDiffUpdatedEvent,
  type CommentResolution,
} from "./events.js";
import { resolveReviewSubject } from "./subject.js";
import { driveReviewTo } from "./transitions.js";
import type { ReviewContext, RunSettledOutcome } from "./types.js";

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
  outcome: RunSettledOutcome,
  open: ReviewCommentRow[],
  requestedBefore: ReadonlyMap<string, string | null>,
  diff: CanonicalDiff | null,
  now: string,
): void {
  const fileShas = new Map(diff?.files.map((file) => [file.path, file.sha]) ?? []);
  for (const comment of open) {
    if (comment.fix_requested_at !== null) {
      // A fix requested while the diff was computed belongs to the pass it queued, not to this one.
      if (requestedBefore.get(comment.id) !== comment.fix_requested_at) continue;
      // Stamped before the transition: an addressed comment must never exist without
      // the pass that addressed it, or its proof would have to guess one.
      if (outcome.agentSessionId !== null) {
        setReviewCommentFixedBy(ctx.db, comment.id, outcome.agentSessionId);
      }
      resolveComment(ctx, outcome.runId, comment, "addressed", now);
    } else if (diff !== null && fileShas.get(comment.file_path) !== comment.diff_sha) {
      resolveComment(ctx, outcome.runId, comment, "outdated", now);
    }
  }
}

function deriveReviewStatus(ctx: ReviewContext, runId: string): void {
  const review = getReviewForSubject(ctx.db, runId);
  if (!review || review.status === "open") return;
  const stillOpen = listReviewCommentsForSubject(ctx.db, runId).some(
    (comment) => comment.status === "open",
  );
  if (!stillOpen) {
    if (review.status !== "resolved") driveReviewTo(ctx, review, "resolved");
  } else if (review.status === "changes_requested") {
    driveReviewTo(ctx, review, "in_review");
  }
}

/** After a turn settles: refresh the diff projection, resolve anchors, converge the review. */
export async function onRunSettled(ctx: ReviewContext, outcome: RunSettledOutcome): Promise<void> {
  const run = getRun(ctx.db, outcome.runId);
  if (!run) return;
  const openComments = () =>
    listReviewCommentsForSubject(ctx.db, run.id).filter((comment) => comment.status === "open");

  // The turn delivered and is held for its supervisor: releasing its fix requests would drop work that landed.
  if (outcome.classification === "awaiting_supervision") return;
  if (outcome.classification !== "completed") {
    releasePendingFixes(ctx, openComments());
    return;
  }

  const requestedBefore = new Map(
    openComments().map((comment) => [comment.id, comment.fix_requested_at]),
  );
  const diff = await computeDiff(resolveReviewSubject(ctx, { kind: "run", id: run.id }));
  // Read after the diff: a comment the reviewer changed meanwhile must not transition from a stale status.
  const open = openComments();
  const now = new Date().toISOString();
  if (diff !== null) {
    emitLedgerEvent(ctx.db, ctx.dataDir, run.id, buildDiffUpdatedEvent(run.id, diff, now));
  }
  resolveSettledComments(ctx, outcome, open, requestedBefore, diff, now);
  deriveReviewStatus(ctx, run.id);
}
