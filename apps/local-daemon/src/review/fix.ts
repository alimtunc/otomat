import {
  getReviewForSubject,
  listCompeteGroupsForRun,
  listReviewCommentsForSubject,
  listStepRunsForRun,
  setReviewCommentFixRequested,
  type RunRow,
} from "@otomat/db";
import {
  CONTEXT_MAX_REVIEW_COMMENTS,
  FIX_REVIEW_COMMENTS_STEP_NAME,
  isAgentFixEligible,
  isRunPlanCompeteGroup,
  type CompeteGroupState,
  type ContextReviewComment,
  type RunPlanNode,
  type StepRunState,
} from "@otomat/domain";

import { reviewCommentContext } from "#context";
import { diffSnapshotOrNull } from "#git";

import { CommentsNotFixableError } from "./errors.js";
import { driveReviewTo } from "./transitions.js";
import type { FixPreparation, FixRequest, ReviewContext } from "./types.js";

/** A node whose work is already in the worktree: a succeeded step, or a compete group with a winner. */
function producedTheDiff(
  node: RunPlanNode,
  steps: ReadonlyMap<string, StepRunState>,
  groups: ReadonlyMap<string, CompeteGroupState>,
): boolean {
  if (isRunPlanCompeteGroup(node)) return groups.get(node.id) === "selected";
  return steps.get(node.id) === "succeeded";
}

/** The plan nodes that produced the reviewed diff; the fix step waits on them so it never races unfinished work. */
function diffProducingNodes(ctx: ReviewContext, run: RunRow): string[] {
  const steps = new Map(listStepRunsForRun(ctx.db, run.id).map((step) => [step.id, step.status]));
  const groups = new Map(
    listCompeteGroupsForRun(ctx.db, run.id).map((group) => [group.id, group.status]),
  );
  const produced = run.plan_json.steps.filter((node) => producedTheDiff(node, steps, groups));
  return produced.map((node) => node.id);
}

/** Freezes the fix context of every eligible agent comment; mutates nothing. */
function prepareFix(ctx: ReviewContext, run: RunRow): FixPreparation {
  const eligible = listReviewCommentsForSubject(ctx.db, run.id).filter(isAgentFixEligible);
  if (eligible.length === 0) {
    throw new CommentsNotFixableError(
      "No open agent comment is waiting for a fix. Address a comment to the agent first.",
    );
  }
  if (eligible.length > CONTEXT_MAX_REVIEW_COMMENTS) {
    throw new CommentsNotFixableError(
      `${eligible.length} agent comments are open; a fix step carries at most ${CONTEXT_MAX_REVIEW_COMMENTS}. Fix or resolve some first.`,
    );
  }
  // One captured snapshot: every "current file" comes from the same tree, and a commented path
  // that is a symlink stays the symlink's target text, never a host file.
  const binding = ctx.repositories.forRun(run.id);
  const snapshot = binding === null ? null : diffSnapshotOrNull(binding.service, run.id);
  const comments: ContextReviewComment[] = eligible.map((comment) =>
    reviewCommentContext(
      comment,
      snapshot === null
        ? null
        : snapshot.fileBlobs({ path: comment.file_path, oldPath: null }).head,
    ),
  );
  return { comments, dependsOn: diffProducingNodes(ctx, run) };
}

/**
 * Stamps `fix_requested_at` on each frozen comment and drives the review to
 * `changes_requested`. The drive is a no-op when the run has no review or it is
 * already `changes_requested`.
 */
function markFixRequested(
  ctx: ReviewContext,
  runId: string,
  comments: readonly ContextReviewComment[],
): void {
  const now = new Date().toISOString();
  for (const comment of comments) setReviewCommentFixRequested(ctx.db, comment.id, now);
  const review = getReviewForSubject(ctx.db, runId);
  if (review && review.status !== "changes_requested") {
    driveReviewTo(ctx, review, "changes_requested");
  }
}

/**
 * Every eligible agent comment becomes one appended fix step. Order is the
 * invariant: freeze context, append the step, then stamp — a failed append
 * leaves every comment unstamped and the review untouched.
 */
export async function requestFix(
  ctx: ReviewContext,
  run: RunRow,
  request: FixRequest,
): Promise<RunRow> {
  const preparation = prepareFix(ctx, run);
  const updated = await ctx.appendRunStep(run.id, {
    name: FIX_REVIEW_COMMENTS_STEP_NAME,
    note: request.note,
    references: request.references,
    reviewComments: preparation.comments,
    selector: request.selector,
    overrides: request.overrides,
    dependsOn: preparation.dependsOn,
    replaces: null,
    origin: "review_fix",
  });
  markFixRequested(ctx, run.id, preparation.comments);
  return updated;
}
