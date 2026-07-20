import { WorktreeNotFoundError, type CanonicalDiff } from "#git";

import type { ReviewContext, RunDiffResult } from "./types.js";

/** The live canonical diff of one worktree owner in the run's repository — the run itself unless a candidate owner is named. Null when that owner has no worktree; never a fabricated diff. */
export function computeDiff(
  ctx: ReviewContext,
  runId: string,
  owner: string = runId,
): CanonicalDiff | null {
  const binding = ctx.repositories.forRun(runId);
  if (binding === null) return null;
  try {
    return binding.service.diff(owner);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

/** A worktree's canonical diff plus its compute timestamp; `diff` is null when the owner has no worktree. */
export function getWorktreeDiff(ctx: ReviewContext, runId: string, owner?: string): RunDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeDiff(ctx, runId, owner) };
}
