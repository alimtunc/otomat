import type { Db, ReviewCommentRow, ReviewRow, RunRow } from "@otomat/db";
import type { CreateReviewCommentRequest } from "@otomat/domain";

import type { CanonicalDiff, RepositoryResolver } from "#git";
import type { ReconcileClassification } from "#supervisor";

export interface ReviewServiceConfig {
  db: Db;
  /** Root of the run artifact dirs — review events land in the same per-run ledger. */
  dataDir: string;
  /** A run without a repository has no diff or review-comment surface. */
  repositories: RepositoryResolver;
}

/** Shared handles every review operation threads through — the module's equivalent of SupervisorState. */
export type ReviewContext = ReviewServiceConfig;

export interface RunDiffResult {
  computedAt: string;
  /** Null when the run has no worktree — never a fabricated diff. */
  diff: CanonicalDiff | null;
}

export interface ReviewDetailResult {
  review: ReviewRow | null;
  comments: ReviewCommentRow[];
}

export interface FixPreparation {
  prompt: string;
  commentIds: string[];
}

export interface RunSettledOutcome {
  runId: string;
  classification: ReconcileClassification;
}

export interface ReviewService {
  getRunDiff(run: Pick<RunRow, "id">): RunDiffResult;
  getReviewDetail(runId: string): ReviewDetailResult;
  /** Verifies the anchor against the live diff and captures the hunk snapshot before persisting. */
  addComment(run: Pick<RunRow, "id">, request: CreateReviewCommentRequest): ReviewCommentRow;
  /** Builds the fix prompt without mutating anything; the caller spawns the turn, then marks. */
  prepareFix(run: RunRow, commentIds: string[]): FixPreparation;
  /** Stamps the selected comments and drives the review to `changes_requested`. */
  markFixRequested(runId: string, commentIds: string[]): void;
  /** Post-settle hook: refreshes the diff projection and resolves comment anchors. */
  onRunSettled(outcome: RunSettledOutcome): void;
}
