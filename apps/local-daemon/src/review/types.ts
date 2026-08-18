import type { Db, PullRequestRow, ReviewCommentRow, ReviewRow, RunRow } from "@otomat/db";
import type {
  ContextReference,
  ContextReviewComment,
  CreateReviewCommentRequest,
  DiffSide,
  ExecutionOverrides,
  ReviewDestinationAvailability,
  ReviewFixAuthority,
} from "@otomat/domain";

import type { AgentConfigSelector } from "#agents";
import type { CanonicalDiff, DiffSnapshot, RepositoryResolver } from "#git";
import type { AppendStepInput, ReconcileClassification } from "#supervisor";

/** What a review surface hangs from: a run's worktree, or a pull request Otomat adopted. */
export type ReviewSubjectRef =
  | {
      kind: "run";
      id: string;
      /** A compete candidate reviews its own worktree, not the run's. */ owner?: string;
    }
  | { kind: "pull_request"; id: string };

export interface ReviewSubject {
  /** `reviews.subject_id`: the key every comment of this surface hangs from. */
  id: string;
  /** Run whose ledger records this review; null for an adopted pull request, which has no run and no ledger. */
  ledgerRunId: string | null;
  /** Null when the diff genuinely cannot be read — never a fabricated one. */
  snapshot(): DiffSnapshot | null;
  fixAuthority(): ReviewFixAuthority;
  destinations(): ReviewDestinationAvailability;
  /** The pull request a `pr_review` comment is published to; null when none exists. */
  pullRequest(): PullRequestRow | null;
}

/** One comment as the provider needs it; `suggestion` is serialized by the provider, not by review. */
export interface PullRequestCommentInput {
  /** The commit the comment anchors to — review owns that policy, the provider only forwards it. */
  commitSha: string;
  filePath: string;
  side: DiffSide;
  startLine: number | null;
  line: number | null;
  body: string;
  suggestion: string | null;
}

export interface ReviewServiceConfig {
  db: Db;
  /** Root of the run artifact dirs — review events land in the same per-run ledger. */
  dataDir: string;
  /** A run without a repository has no diff or review-comment surface. */
  repositories: RepositoryResolver;
  /** The supervisor's append capability; late-bound in the composition root because each side needs the other. */
  appendRunStep(runId: string, input: AppendStepInput): Promise<RunRow>;
  /** Rejects with the reason review stores on the comment and shows. */
  publishReviewComment(
    pullRequestId: string,
    input: PullRequestCommentInput,
  ): Promise<{ url: string }>;
}

/** Shared handles every review operation threads through — the module's equivalent of SupervisorState. */
export type ReviewContext = ReviewServiceConfig;

export interface ReviewDiffResult {
  computedAt: string;
  /** Null when the subject has nothing to diff from — never a fabricated diff. */
  diff: CanonicalDiff | null;
}

export interface ReviewDetailResult {
  review: ReviewRow | null;
  comments: ReviewCommentRow[];
  fixAuthority: ReviewFixAuthority;
  destinations: ReviewDestinationAvailability;
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
  /** A run reviews its worktree (a compete candidate names its step id as owner); a pull request reviews its imported head. */
  getDiff(ref: ReviewSubjectRef): ReviewDiffResult;
  getReviewDetail(ref: ReviewSubjectRef): ReviewDetailResult;
  /** A `pr_review` comment is published on create; a GitHub refusal comes back on it, never as a failed create. */
  addComment(ref: ReviewSubjectRef, request: CreateReviewCommentRequest): Promise<ReviewCommentRow>;
  /** The same call retries a failed publication. */
  publishComment(ref: ReviewSubjectRef, commentId: string): Promise<ReviewCommentRow>;
  getFileBlobs(ref: ReviewSubjectRef, request: FileBlobsRequest): FileBlobsResult;
  /** The selected open comments become one appended fix step; refused while a turn is in flight. */
  requestFix(run: RunRow, request: FixRequest): Promise<RunRow>;
  /** Post-settle hook: refreshes the diff projection and resolves comment anchors. */
  onRunSettled(outcome: RunSettledOutcome): void;
}
