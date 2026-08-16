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

type Candidate = { classified: Classification | null; evidence: IssueExecutionEvidence };

/** Active work outranks a delivered PR, which outranks a run awaiting review, which outranks a stopped cycle. */
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

/** Rank 0 is a run with nothing left to say; it still competes, so a completed run neutralizes the failures its cycle replaced. */
function rank(classified: Classification | null): number {
  return classified === null ? 0 : KIND_RANK[classified.kind];
}

/** The last run answers for the issue; rank only separates rows of one run and genuine ties, and the id keeps equal or missing timestamps deterministic. */
function outranks(candidate: Candidate, best: Candidate): boolean {
  if (candidate.evidence.run_created_at !== best.evidence.run_created_at) {
    return candidate.evidence.run_created_at > best.evidence.run_created_at;
  }
  if (rank(candidate.classified) !== rank(best.classified)) {
    return rank(candidate.classified) > rank(best.classified);
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

/** Reduce an issue's run/PR evidence to the deterministic execution state of its last run; no evidence, or a last run at rest, projects to `none`. */
export function projectIssueExecution(evidence: readonly IssueExecutionEvidence[]): IssueExecution {
  let best: Candidate | null = null;
  for (const item of evidence) {
    const candidate: Candidate = { classified: classifyEvidence(item), evidence: item };
    if (best === null || outranks(candidate, best)) best = candidate;
  }
  if (best === null || best.classified === null) return { state: "none", run_id: null };
  return toExecution({ ...best.classified, evidence: best.evidence });
}
