import { getFileBlobs } from "./blobs.js";
import { addComment, getReviewDetail } from "./comments.js";
import { getSubjectDiff } from "./diff.js";
import { requestFix } from "./fix.js";
import { publishComment } from "./publication.js";
import { onRunSettled } from "./settle.js";
import { resolveReviewSubject } from "./subject.js";
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
    getDiff: (ref) => getSubjectDiff(subject(ref)),
    getReviewDetail: (ref) => getReviewDetail(ctx, subject(ref)),
    addComment: (ref, request) => addComment(ctx, subject(ref), request),
    publishComment: (ref, commentId) => publishComment(ctx, subject(ref), commentId),
    getFileBlobs: (ref, request) => getFileBlobs(subject(ref), request),
    requestFix: (run, request) => requestFix(ctx, run, request),
    onRunSettled: (outcome) => onRunSettled(ctx, outcome),
  };
}
