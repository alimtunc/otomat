import type { IssueExecution, IssueExecutionState } from "../contracts/entities/issue-execution.js";
import type { WorktreeStatus } from "../contracts/entities/workspace.js";
import type { PullRequestPublicationState } from "../state-machines/pull-request-publication.js";
import type { PullRequestState } from "../state-machines/pull-request.js";
import { isRunSettled, type RunState } from "../state-machines/run.js";

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
  pr_status: PullRequestState | null;
  pr_publication: PullRequestPublicationState | null;
}

type ExecutionKind = Exclude<IssueExecutionState, "none">;

interface Winner {
  kind: ExecutionKind;
  run_id: string;
  created_at: string;
}

/** Active work outranks a delivered PR, which outranks a run merely awaiting review; ties break to the most recent run. */
const KIND_RANK: Record<ExecutionKind, number> = { running: 3, pr_open: 2, reviewing: 1 };

/** A pull request counts only once really created on the provider and not yet merged or closed. */
function hasOpenPullRequest(evidence: IssueExecutionEvidence): boolean {
  if (evidence.pr_publication !== "created") return false;
  return evidence.pr_status === "open" || evidence.pr_status === "draft";
}

/** A run is "running" (active work) while it is neither terminal nor resting at review_ready. */
function classifyEvidence(evidence: IssueExecutionEvidence): ExecutionKind | null {
  if (!isRunSettled(evidence.run_status) && evidence.run_status !== "review_ready") {
    return "running";
  }
  if (hasOpenPullRequest(evidence)) return "pr_open";
  if (evidence.run_status === "review_ready") return "reviewing";
  return null;
}

function outranks(candidate: IssueExecutionEvidence, kind: ExecutionKind, best: Winner): boolean {
  if (KIND_RANK[kind] !== KIND_RANK[best.kind]) return KIND_RANK[kind] > KIND_RANK[best.kind];
  if (candidate.run_created_at !== best.created_at) {
    return candidate.run_created_at > best.created_at;
  }
  return candidate.run_id > best.run_id;
}

/** Reduce an issue's run/PR evidence to one deterministic execution state; no evidence projects to `none`. */
export function projectIssueExecution(evidence: readonly IssueExecutionEvidence[]): IssueExecution {
  let best: Winner | null = null;
  for (const item of evidence) {
    const kind = classifyEvidence(item);
    if (kind === null) continue;
    if (best === null || outranks(item, kind, best)) {
      best = { kind, run_id: item.run_id, created_at: item.run_created_at };
    }
  }
  return best === null
    ? { state: "none", run_id: null }
    : { state: best.kind, run_id: best.run_id };
}
