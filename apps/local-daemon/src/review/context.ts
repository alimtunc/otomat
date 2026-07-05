import { updateReviewStatus, type Db, type ReviewRow } from "@otomat/db";
import {
  IllegalTransitionError,
  reviewMachine,
  shortestPath,
  type ReviewState,
} from "@otomat/domain";

import { WorktreeNotFoundError, type CanonicalDiff, type GitWorktreeService } from "#git";

/** Shared handles every review operation threads through — the module's equivalent of SupervisorState. */
export interface ReviewContext {
  db: Db;
  dataDir: string;
  worktrees: GitWorktreeService | null;
}

/** Re-read a row we just wrote; a null means it vanished under us — a real fault, not a not-found. */
export function reloadOrThrow<T>(read: () => T | null | undefined, describe: string): T {
  const row = read();
  if (row === null || row === undefined) throw new Error(describe);
  return row;
}

/** The run's live canonical diff, or null when it has no worktree — never a fabricated diff. */
export function computeDiff(ctx: ReviewContext, runId: string): CanonicalDiff | null {
  if (ctx.worktrees === null) return null;
  try {
    return ctx.worktrees.diff(runId);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

/** Walks the review to `to` along the shortest legal path. */
export function driveReviewTo(ctx: ReviewContext, review: ReviewRow, to: ReviewState): void {
  const path = shortestPath(reviewMachine, review.status, to);
  if (path === null) throw new IllegalTransitionError(reviewMachine.name, review.status, to);
  for (const state of path) updateReviewStatus(ctx.db, review.id, state);
}
