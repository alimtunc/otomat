import { getFileBlobs } from "./blobs.js";
import { addComment } from "./comments.js";
import { getBranchCommits } from "./commits.js";
import { getDiff } from "./diff.js";
import { getCommentFixProof } from "./fix-proof.js";
import { requestFix } from "./fix.js";
import { publishComment } from "./publication.js";
import { importViewedFiles, setReviewedFile } from "./reviewed-sync.js";
import { onRunSettled } from "./settle.js";
import { resolveReviewSubject } from "./subject.js";
import { getReviewDetail } from "./surface.js";
import type {
  ReviewContext,
  ReviewService,
  ReviewServiceConfig,
  ReviewSubjectRef,
} from "./types.js";

/** Wires the shared {@link ReviewContext} and delegates each operation to its concern module. */
export function createReviewService(config: ReviewServiceConfig): ReviewService {
  const ctx: ReviewContext = config;
  const subject = (ref: ReviewSubjectRef) => resolveReviewSubject(ctx, ref);
  return {
    getDiff: (ref, scope) => getDiff(ctx, ref, scope),
    getBranchCommits: (runId) => getBranchCommits(ctx, runId),
    getCommentFixProof: (runId, commentId) => getCommentFixProof(ctx, runId, commentId),
    getReviewDetail: (ref) => getReviewDetail(ctx, subject(ref)),
    addComment: (ref, request) => addComment(ctx, subject(ref), request),
    publishComment: (ref, commentId) => publishComment(ctx, subject(ref), commentId),
    getFileBlobs: (ref, request) => getFileBlobs(ctx, ref, request),
    setReviewedFile: (ref, request) => setReviewedFile(ctx, subject(ref), request),
    importViewedFiles: (pullRequestId) => importViewedFiles(ctx, pullRequestId),
    requestFix: (run, request) => requestFix(ctx, run, request),
    onRunSettled: (outcome) => onRunSettled(ctx, outcome),
  };
}
