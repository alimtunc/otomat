import type {
  IssueExecution,
  IssueExecutionFailureReason,
  IssueExecutionState,
} from "../contracts/entities/issue-execution.js";
import { isRunSettled } from "../state-machines/run.js";
import type { IssueExecutionEvidence } from "./evidence.js";
import { holdsWorkspace } from "./issue-workspace.js";

type ExecutionKind = Exclude<IssueExecutionState, "none">;

type Classification =
  | { kind: Exclude<ExecutionKind, "failed"> }
  | { kind: "failed"; reason: IssueExecutionFailureReason };

type Winner = Classification & { evidence: IssueExecutionEvidence };

/** Active work outranks a delivered PR, which outranks a run awaiting review, which outranks a stopped cycle; ties break to the most recent run. */
const KIND_RANK: Record<ExecutionKind, number> = {
  running: 4,
  pr_open: 3,
  reviewing: 2,
  failed: 1,
};

/** A pull request counts only once really created on the provider and not yet merged or closed. */
function hasOpenPullRequest(evidence: IssueExecutionEvidence): boolean {
  if (evidence.pr_publication !== "created") return false;
  return evidence.pr_status === "open" || evidence.pr_status === "draft";
}

/** A stop that still holds the issue's workspace: the work owns a branch, a history and often changes, so it is recoverable work rather than work never started. */
function failureReason(evidence: IssueExecutionEvidence): IssueExecutionFailureReason | null {
  if (!holdsWorkspace(evidence)) return null;
  if (evidence.run_status === "failed") return "failed";
  if (evidence.run_status === "canceled") return "canceled";
  return evidence.run_status === "awaiting_human" ? "interrupted" : null;
}

/** A run is "running" (active work) while it is neither stopped, nor terminal, nor resting at review_ready. */
function classifyEvidence(evidence: IssueExecutionEvidence): Classification | null {
  const reason = failureReason(evidence);
  if (reason !== null) return { kind: "failed", reason };
  if (!isRunSettled(evidence.run_status) && evidence.run_status !== "review_ready") {
    return { kind: "running" };
  }
  if (hasOpenPullRequest(evidence)) return { kind: "pr_open" };
  if (evidence.run_status === "review_ready") return { kind: "reviewing" };
  return null;
}

function outranks(candidate: Winner, best: Winner): boolean {
  if (KIND_RANK[candidate.kind] !== KIND_RANK[best.kind]) {
    return KIND_RANK[candidate.kind] > KIND_RANK[best.kind];
  }
  if (candidate.evidence.run_created_at !== best.evidence.run_created_at) {
    return candidate.evidence.run_created_at > best.evidence.run_created_at;
  }
  return candidate.evidence.run_id > best.evidence.run_id;
}

function toExecution(winner: Winner): IssueExecution {
  if (winner.kind !== "failed") return { state: winner.kind, run_id: winner.evidence.run_id };
  return {
    state: "failed",
    run_id: winner.evidence.run_id,
    failure: { reason: winner.reason, step: winner.evidence.halted_step },
  };
}

/** Reduce an issue's run/PR evidence to one deterministic execution state; no evidence projects to `none`. */
export function projectIssueExecution(evidence: readonly IssueExecutionEvidence[]): IssueExecution {
  let best: Winner | null = null;
  for (const item of evidence) {
    const classified = classifyEvidence(item);
    if (classified === null) continue;
    const candidate: Winner = { ...classified, evidence: item };
    if (best === null || outranks(candidate, best)) best = candidate;
  }
  return best === null ? { state: "none", run_id: null } : toExecution(best);
}
