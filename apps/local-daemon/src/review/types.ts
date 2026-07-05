import type { Db, PullRequestRow, ReviewCommentRow, ReviewRow, RunRow } from "@otomat/db";
import type { CreateReviewCommentRequest, PreparePullRequestRequest } from "@otomat/domain";

import type { CanonicalDiff, GitWorktreeService } from "#git";
import type { ReconcileClassification } from "#supervisor/types";

export interface ReviewServiceConfig {
  db: Db;
  /** Root of the run artifact dirs — review events land in the same per-run ledger. */
  dataDir: string;
  /** Null when the project has no git repository; diffs and comments are then unavailable. */
  worktrees: GitWorktreeService | null;
}

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

export interface PreparePullRequestResult {
  row: PullRequestRow;
  created: boolean;
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
  getPullRequest(runId: string): PullRequestRow | null;
  preparePullRequest(
    run: Pick<RunRow, "id">,
    request: PreparePullRequestRequest,
  ): PreparePullRequestResult;
  /** Post-settle hook: refreshes the diff projection and resolves comment anchors. */
  onRunSettled(outcome: RunSettledOutcome): void;
}
