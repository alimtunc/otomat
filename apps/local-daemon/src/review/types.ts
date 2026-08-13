import type { Db, ReviewCommentRow, ReviewRow, RunRow } from "@otomat/db";
import type {
  ContextReference,
  ContextReviewComment,
  CreateReviewCommentRequest,
  ExecutionOverrides,
  ReviewFixAuthority,
} from "@otomat/domain";

import type { AgentConfigSelector } from "#agents";
import type { CanonicalDiff, RepositoryResolver } from "#git";
import type { AppendStepInput, ReconcileClassification } from "#supervisor";

export interface ReviewServiceConfig {
  db: Db;
  /** Root of the run artifact dirs — review events land in the same per-run ledger. */
  dataDir: string;
  /** A run without a repository has no diff or review-comment surface. */
  repositories: RepositoryResolver;
  /** The supervisor's append capability; late-bound in the composition root because each side needs the other. */
  appendRunStep(runId: string, input: AppendStepInput): Promise<RunRow>;
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
  fixAuthority: ReviewFixAuthority;
}

export interface FileBlobsRequest {
  path: string;
  /** The `DiffFile.sha` the reviewer is looking at; a mismatch is refused, never reconciled. */
  sha: string;
}

export interface FileBlobsResult {
  base: string | null;
  head: string | null;
}

export interface FixPreparation {
  /** The selected comments frozen with their pinned hunks and the file each stood against. */
  comments: ContextReviewComment[];
  commentIds: string[];
  /** Plan node ids that produced the reviewed diff; the appended fix step depends on them. */
  dependsOn: string[];
}

export interface FixRequest {
  commentIds: string[];
  selector: AgentConfigSelector;
  overrides: ExecutionOverrides;
  name?: string;
  note: string | null;
  references: readonly ContextReference[];
}

export interface RunSettledOutcome {
  runId: string;
  classification: ReconcileClassification;
}

export interface ReviewService {
  /** Defaults to the run's own worktree; a compete candidate names its step id as owner. */
  getWorktreeDiff(run: Pick<RunRow, "id">, owner?: string): RunDiffResult;
  getReviewDetail(runId: string): ReviewDetailResult;
  /** Verifies the anchor against the live diff and captures the hunk snapshot before persisting. */
  addComment(run: Pick<RunRow, "id">, request: CreateReviewCommentRequest): ReviewCommentRow;
  getFileBlobs(run: Pick<RunRow, "id">, request: FileBlobsRequest): FileBlobsResult;
  /** The selected open comments become one appended fix step; refused while a turn is in flight. */
  requestFix(run: RunRow, request: FixRequest): Promise<RunRow>;
  /** Post-settle hook: refreshes the diff projection and resolves comment anchors. */
  onRunSettled(outcome: RunSettledOutcome): void;
}
