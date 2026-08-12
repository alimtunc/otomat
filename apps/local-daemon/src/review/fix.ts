import {
  getIssue,
  getReviewForRun,
  listCompeteGroupsForRun,
  listReviewCommentsForRun,
  listStepRunsForRun,
  setReviewCommentFixRequested,
  type RunRow,
} from "@otomat/db";
import {
  FIX_REVIEW_COMMENTS_STEP_NAME,
  isRunPlanCompeteGroup,
  type CompeteGroupState,
  type RunPlanNode,
  type StepRunState,
} from "@otomat/domain";

import { diffSnapshotOrNull } from "#git";

import { CommentsNotFixableError } from "./errors.js";
import { buildFixPrompt, type FixCommentContext } from "./fix-context.js";
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

/** Freezes the fix context of the selected open comments; mutates nothing. */
function prepareFix(ctx: ReviewContext, run: RunRow, commentIds: string[]): FixPreparation {
  const comments = listReviewCommentsForRun(ctx.db, run.id);
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  // One captured snapshot: the prompt's diff and every "current file" come from the same tree,
  // and a commented path that is a symlink stays the symlink's target text, never a host file.
  const binding = ctx.repositories.forRun(run.id);
  const snapshot = binding === null ? null : diffSnapshotOrNull(binding.service, run.id);
  const selected: FixCommentContext[] = [];
  for (const commentId of commentIds) {
    const comment = byId.get(commentId);
    if (!comment) throw new CommentsNotFixableError(`comment ${commentId} not found on run`);
    if (comment.status !== "open") {
      throw new CommentsNotFixableError(`comment ${commentId} is ${comment.status}, not open`);
    }
    selected.push({
      comment,
      currentFile:
        snapshot === null
          ? null
          : snapshot.fileBlobs({ path: comment.file_path, oldPath: null }).head,
    });
  }

  const issue = getIssue(ctx.db, run.issue_id);
  return {
    prompt: buildFixPrompt({
      issueTitle: issue?.title ?? "Local run",
      issueBody: issue?.body ?? null,
      branch: run.branch,
      diff: snapshot?.diff ?? null,
      comments: selected,
    }),
    commentIds,
    dependsOn: diffProducingNodes(ctx, run),
  };
}

/**
 * Stamps `fix_requested_at` on each selected comment and drives the review to
 * `changes_requested`. The drive is a no-op when the run has no review or it is
 * already `changes_requested`. Does not validate the comment ids — prepareFix does.
 */
function markFixRequested(ctx: ReviewContext, runId: string, commentIds: string[]): void {
  const now = new Date().toISOString();
  for (const commentId of commentIds) setReviewCommentFixRequested(ctx.db, commentId, now);
  const review = getReviewForRun(ctx.db, runId);
  if (review && review.status !== "changes_requested") {
    driveReviewTo(ctx, review, "changes_requested");
  }
}

/**
 * The selected open comments become one appended fix step. Order is the
 * invariant: freeze context, append the step, then stamp — a failed append
 * leaves every comment unstamped and the review untouched.
 */
export async function requestFix(
  ctx: ReviewContext,
  run: RunRow,
  request: FixRequest,
): Promise<RunRow> {
  const preparation = prepareFix(ctx, run, request.commentIds);
  const updated = await ctx.appendRunStep(run.id, {
    name: request.name ?? FIX_REVIEW_COMMENTS_STEP_NAME,
    prompt: preparation.prompt,
    selector: request.selector,
    ...(request.model ? { model: request.model } : {}),
    dependsOn: preparation.dependsOn,
    origin: "review_fix",
  });
  markFixRequested(ctx, run.id, preparation.commentIds);
  return updated;
}
