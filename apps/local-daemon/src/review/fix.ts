import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  isRunPlanCompeteGroup,
  type CompeteGroupState,
  type RunPlanNode,
  type StepRunState,
} from "@otomat/domain";

import { computeDiff } from "./diff.js";
import { CommentsNotFixableError } from "./errors.js";
import { buildFixPrompt, type FixCommentContext } from "./fix-context.js";
import { driveReviewTo } from "./transitions.js";
import type { FixPreparation, ReviewContext } from "./types.js";

/** Current worktree content of a commented file, or null when the run has no worktree / the file is gone. */
function readCurrentFile(ctx: ReviewContext, runId: string, filePath: string): string | null {
  const worktree = ctx.repositories.forRun(runId)?.service.get(runId);
  if (!worktree) return null;
  try {
    return readFileSync(join(worktree.path, filePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

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

/** Freezes the fix context of the selected open comments; mutates nothing (the caller appends the step, then marks). */
export function prepareFix(ctx: ReviewContext, run: RunRow, commentIds: string[]): FixPreparation {
  const comments = listReviewCommentsForRun(ctx.db, run.id);
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const selected: FixCommentContext[] = [];
  for (const commentId of commentIds) {
    const comment = byId.get(commentId);
    if (!comment) throw new CommentsNotFixableError(`comment ${commentId} not found on run`);
    if (comment.status !== "open") {
      throw new CommentsNotFixableError(`comment ${commentId} is ${comment.status}, not open`);
    }
    selected.push({ comment, currentFile: readCurrentFile(ctx, run.id, comment.file_path) });
  }

  const issue = getIssue(ctx.db, run.issue_id);
  return {
    prompt: buildFixPrompt({
      issueTitle: issue?.title ?? "Local run",
      issueBody: issue?.body ?? null,
      branch: run.branch,
      diff: computeDiff(ctx, run.id),
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
export function markFixRequested(ctx: ReviewContext, runId: string, commentIds: string[]): void {
  const now = new Date().toISOString();
  for (const commentId of commentIds) setReviewCommentFixRequested(ctx.db, commentId, now);
  const review = getReviewForRun(ctx.db, runId);
  if (review && review.status !== "changes_requested") {
    driveReviewTo(ctx, review, "changes_requested");
  }
}
