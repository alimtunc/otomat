import { z } from "zod";

import { isRunTerminal, type RunState } from "../entity-states.js";

/**
 * Local execution state projected per issue from persisted runs and pull
 * requests. Deliberately distinct from the issue's business/source `status`
 * (which a run launch, review, or PR never mutates): this says what Otomat is
 * actually doing for the issue right now, `none` when there is no evidence.
 */
export const ISSUE_EXECUTION_STATES = ["running", "reviewing", "pr_open", "none"] as const;
export type IssueExecutionState = (typeof ISSUE_EXECUTION_STATES)[number];

export const issueExecutionSchema = z.object({
  state: z.enum(ISSUE_EXECUTION_STATES),
  /** The run the state is derived from; null only when `state` is `none`. */
  run_id: z.string().min(1).nullable(),
});
export type IssueExecution = z.infer<typeof issueExecutionSchema>;

/** One persisted run's contribution to its issue's execution state. `pr_open` is true only for a really-created, still-open pull request. */
export interface IssueExecutionEvidence {
  run_id: string;
  run_status: RunState;
  run_created_at: string;
  pr_open: boolean;
}

type ExecutionKind = "running" | "pr_open" | "reviewing";

/** Active work outranks a delivered PR, which outranks a run merely awaiting review; ties break to the most recent run. */
const KIND_RANK: Record<ExecutionKind, number> = { running: 3, pr_open: 2, reviewing: 1 };

/** A run is "running" (active work) while it is neither terminal nor resting at review_ready. */
function classifyEvidence(evidence: IssueExecutionEvidence): ExecutionKind | null {
  if (!isRunTerminal(evidence.run_status) && evidence.run_status !== "review_ready") {
    return "running";
  }
  if (evidence.pr_open) return "pr_open";
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

interface Winner {
  kind: ExecutionKind;
  run_id: string;
  created_at: string;
}

/**
 * Reduce an issue's run/PR evidence to a single deterministic execution state.
 * Precedence: active work > open PR > awaiting review; equal ranks resolve to
 * the most recent run (then the greater id), so live work never disappears
 * behind an older terminal run. No evidence projects to `none`.
 */
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
