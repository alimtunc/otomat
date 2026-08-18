import type { WorktreeStatus } from "../contracts/entities/workspace.js";
import type { PullRequestPublicationState } from "../state-machines/pull-request-publication.js";
import type { PullRequestState } from "../state-machines/pull-request.js";
import type { RunState } from "../state-machines/run.js";

/** The last step of a run that failed or went stale, as stored. */
export interface HaltedStepEvidence {
  id: string;
  name: string;
}

/** One persisted run's contribution to its issue's execution and workspace state, as stored. */
export interface IssueExecutionEvidence {
  run_id: string;
  run_status: RunState;
  run_created_at: string;
  run_branch: string;
  /** `active` while the run still holds its worktree; null when it never had one. */
  worktree_status: WorktreeStatus | null;
  /** When the operator explicitly abandoned this run's workspace; null while the cycle is still continuable. */
  run_abandoned_at: string | null;
  /** Null when no step of this run ever failed — a run canceled before its first failure, or one that never failed at all. */
  halted_step: HaltedStepEvidence | null;
  pr_status: PullRequestState | null;
  pr_publication: PullRequestPublicationState | null;
  /** State of the pull request the issue adopted without a run of its own; it stands against every run of that issue. */
  adopted_pr_status: PullRequestState | null;
}
