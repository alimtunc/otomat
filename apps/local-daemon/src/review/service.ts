import { getFileBlobs } from "./blobs.js";
import { addComment, getReviewDetail } from "./comments.js";
import { getWorktreeDiff } from "./diff.js";
import { requestFix } from "./fix.js";
import { onRunSettled } from "./settle.js";
import type { ReviewContext, ReviewService, ReviewServiceConfig } from "./types.js";

/** Wires the shared {@link ReviewContext} and delegates each operation to its concern module. */
export function createReviewService(config: ReviewServiceConfig): ReviewService {
  const ctx: ReviewContext = config;
  return {
    getWorktreeDiff: (run, owner) => getWorktreeDiff(ctx, run.id, owner),
    getReviewDetail: (runId) => getReviewDetail(ctx, runId),
    addComment: (run, request) => addComment(ctx, run.id, request),
    getFileBlobs: (run, request) => getFileBlobs(ctx, run.id, request),
    requestFix: (run, request) => requestFix(ctx, run, request),
    onRunSettled: (outcome) => onRunSettled(ctx, outcome),
  };
}
