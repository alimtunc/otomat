/**
 * Review → fix slice for a run: snapshots the worktree diff, pins comments to
 * it, and drives the review state machine. Anchoring
 * invariant: a comment is
 * pinned to its file's `DiffFile.sha` plus a captured hunk snapshot; the server
 * snapshots the diff and never migrates a stale anchor live — a moved, unaddressed
 * anchor is marked `outdated` on settle. {@link createReviewService} is the entry point.
 * @packageDocumentation
 */
export { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "./errors.js";
export { createReviewService } from "./service.js";
export type {
  FixPreparation,
  ReviewDetailResult,
  ReviewService,
  ReviewServiceConfig,
  RunDiffResult,
  RunSettledOutcome,
} from "./types.js";
