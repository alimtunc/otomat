import { type DeliveryExpectation } from "./expectation.js";

/** Everything the control plane read itself about one turn, so an agent's own account never closes a step. */
export interface DeliveryEvidence {
  start_tree_sha: string | null;
  end_tree_sha: string | null;
  start_head_sha: string | null;
  end_head_sha: string | null;
  changed_files: number;
  /** The branch moved: the turn committed its work. */
  committed: boolean;
  observed_commands: number;
  failed_commands: number;
  /** Questions the turn asked that no answer had settled when its process ended. */
  pending_interactions: number;
  /** Why the workspace delta could not be read at all. */
  evidence_error: string | null;
}

/** One reading for the settle that blocks a step and for the surface that explains it. */
export function deliveryRefusal(
  expectation: DeliveryExpectation,
  evidence: DeliveryEvidence,
): string | null {
  if (evidence.pending_interactions > 0) {
    return "The turn ended while a question it asked was still unanswered; a process exit does not answer it.";
  }
  if (expectation !== "implementation") return null;
  if (evidence.evidence_error !== null) {
    return `This step required an implementation and its workspace could not be read: ${evidence.evidence_error}`;
  }
  if (evidence.changed_files === 0 && !evidence.committed) {
    return "This step required an implementation and left the workspace unchanged.";
  }
  if (evidence.failed_commands > 0) {
    return `This step required an implementation and ${evidence.failed_commands} of the ${evidence.observed_commands} commands it ran failed.`;
  }
  return null;
}
