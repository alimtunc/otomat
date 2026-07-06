import { WorktreeNotFoundError, type CanonicalDiff } from "#git";

import type { ReviewContext, RunDiffResult } from "./types.js";

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

/** The run's canonical diff plus its compute timestamp; `diff` is null when the run has no worktree. */
export function getRunDiff(ctx: ReviewContext, runId: string): RunDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeDiff(ctx, runId) };
}
