import { WorktreeNotFoundError, type CanonicalDiff } from "#git";

import type { ReviewContext, RunDiffResult } from "./types.js";

/** The run's live canonical diff, or null when it has no worktree — never a fabricated diff. */
export function computeDiff(ctx: ReviewContext, runId: string): CanonicalDiff | null {
  const binding = ctx.repositories.forRun(runId);
  if (binding === null) return null;
  try {
    return binding.service.diff(runId);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return null;
    throw error;
  }
}

/** Diff for an isolated candidate owner in the run's repository, including archived evidence. */
export function computeWorktreeDiff(
  ctx: ReviewContext,
  runId: string,
  owner: string,
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

/** The run's canonical diff plus its compute timestamp; `diff` is null when the run has no worktree. */
export function getRunDiff(ctx: ReviewContext, runId: string): RunDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeDiff(ctx, runId) };
}

export function getWorktreeDiff(ctx: ReviewContext, runId: string, owner: string): RunDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeWorktreeDiff(ctx, runId, owner) };
}
