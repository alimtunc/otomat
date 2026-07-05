import { computeDiff, type ReviewContext } from "./context.js";
import type { RunDiffResult } from "./types.js";

/** The run's canonical diff plus its compute timestamp; `diff` is null when the run has no worktree. */
export function getRunDiff(ctx: ReviewContext, runId: string): RunDiffResult {
  return { computedAt: new Date().toISOString(), diff: computeDiff(ctx, runId) };
}
