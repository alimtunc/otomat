import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getIssue,
  getReviewForRun,
  listReviewCommentsForRun,
  setReviewCommentFixRequested,
  type RunRow,
} from "@otomat/db";

import { driveReviewTo, type ReviewContext } from "./context.js";
import { CommentsNotFixableError } from "./errors.js";
import { buildFixPrompt, type FixCommentContext } from "./fix-context.js";
import type { FixPreparation } from "./types.js";

/** Current worktree content of a commented file, or null when the run has no worktree / the file is gone. */
function readCurrentFile(ctx: ReviewContext, runId: string, filePath: string): string | null {
  const worktree = ctx.worktrees?.get(runId);
  if (!worktree) return null;
  try {
    return readFileSync(join(worktree.path, filePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Builds the fix prompt from the selected open comments; mutates nothing (the caller spawns, then marks). */
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
      comments: selected,
    }),
    commentIds,
  };
}

export function markFixRequested(ctx: ReviewContext, runId: string, commentIds: string[]): void {
  const now = new Date().toISOString();
  for (const commentId of commentIds) setReviewCommentFixRequested(ctx.db, commentId, now);
  const review = getReviewForRun(ctx.db, runId);
  if (review && review.status !== "changes_requested") {
    driveReviewTo(ctx, review, "changes_requested");
  }
}
