import type {
  OperationContract,
  OperationPhase,
  OperationPhaseState,
  OperationState,
} from "../contracts/operation.js";
import type {
  PullRequestPublicationActiveState,
  PullRequestPublicationState,
} from "../state-machines/pull-request-publication.js";

/** Written by the daemon when it finds a publication left mid-phase by a process that stopped. */
export const PUBLICATION_INTERRUPTED_CODE = "github_publication_interrupted";

/** The publication row as the operation reads it; `updated_at` is already ISO when it reaches here. */
export interface PullRequestPublicationFacts {
  publication_status: PullRequestPublicationState;
  failed_phase: PullRequestPublicationActiveState | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
}

const PHASES = [
  { key: "generate", label: "Writing metadata", status: "generating" },
  { key: "commit", label: "Committing the workspace", status: "committing" },
  { key: "push", label: "Pushing the branch", status: "pushing" },
  { key: "create", label: "Creating the pull request", status: "creating" },
] as const satisfies readonly {
  key: string;
  label: string;
  status: PullRequestPublicationActiveState;
}[];

function operationState(status: PullRequestPublicationState, code: string | null): OperationState {
  if (status === "created") return "succeeded";
  if (status !== "failed" && status !== "not_configured") return "running";
  return code === PUBLICATION_INTERRUPTED_CODE ? "interrupted" : "failed";
}

function phaseIndex(status: PullRequestPublicationState | null): number {
  return PHASES.findIndex((phase) => phase.status === status);
}

function reachedPhase(state: OperationState, facts: PullRequestPublicationFacts): number {
  if (state === "succeeded") return PHASES.length;
  if (state === "running") return phaseIndex(facts.publication_status);
  return phaseIndex(facts.failed_phase);
}

function phaseState(index: number, reached: number, stopped: boolean): OperationPhaseState {
  if (index < reached) return "done";
  if (index > reached) return "pending";
  return stopped ? "failed" : "active";
}

/** Null while no publication was ever attempted for the run, which a bare `not_configured` row cannot tell apart from one that refused. */
export function projectPullRequestPublicationOperation(
  id: string,
  facts: PullRequestPublicationFacts,
): OperationContract | null {
  const code = facts.error_code;
  if (facts.publication_status === "not_configured" && code === null) return null;
  const state = operationState(facts.publication_status, code);
  const stopped = state === "failed" || state === "interrupted";
  const reached = reachedPhase(state, facts);
  return {
    id,
    kind: "pull_request_publication",
    state,
    phases: PHASES.map<OperationPhase>((phase, index) => ({
      key: phase.key,
      label: phase.label,
      state: phaseState(index, reached, stopped),
    })),
    error:
      state === "succeeded" || code === null
        ? null
        : { code, message: facts.error_message ?? code },
    retryable: stopped,
    updated_at: facts.updated_at,
  };
}
