import type { WorktreeStatus } from "../contracts/entities/workspace.js";
import type { IssueState } from "../state-machines/issue.js";
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
  issue_status: IssueState;
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

/** One group of `runtime.usage` turns as SQLite folded them, keyed by run, step, UTC day and emitter. */
export interface UsageTurnEvidence {
  run_id: string;
  step_run_id: string | null;
  day: string;
  last_occurred_at: string;
  runtime: string | null;
  model: string | null;
  turns: number;
  unreadable_turns: number;
  input_tokens: number | null;
  input_turns: number;
  output_tokens: number | null;
  output_turns: number;
  cost_usd: number | null;
  cost_turns: number;
}

export interface UsageRunEvidence {
  run_id: string;
  status: RunState;
  started_at: string | null;
  completed_at: string | null;
  project_id: string;
  project_name: string;
  issue_id: string;
  issue_identifier: string | null;
  issue_title: string;
}
