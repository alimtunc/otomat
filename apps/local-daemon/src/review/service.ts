import { addComment, getReviewDetail } from "./comments.js";
import { getRunDiff } from "./diff.js";
import { markFixRequested, prepareFix } from "./fix.js";
import { onRunSettled } from "./settle.js";
import type { ReviewContext, ReviewService, ReviewServiceConfig } from "./types.js";

/** Wires the shared {@link ReviewContext} and delegates each operation to its concern module. */
export function createReviewService(config: ReviewServiceConfig): ReviewService {
  const ctx: ReviewContext = config;
  return {
    getRunDiff: (run) => getRunDiff(ctx, run.id),
    getReviewDetail: (runId) => getReviewDetail(ctx, runId),
    addComment: (run, request) => addComment(ctx, run.id, request),
    prepareFix: (run, commentIds) => prepareFix(ctx, run, commentIds),
    markFixRequested: (runId, commentIds) => markFixRequested(ctx, runId, commentIds),
    onRunSettled: (outcome) => onRunSettled(ctx, outcome),
  };
}
