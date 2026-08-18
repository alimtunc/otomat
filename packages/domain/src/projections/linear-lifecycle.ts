import {
  LINEAR_LIFECYCLE_PHASES,
  type IssueSourceLifecycle,
  type LinearLifecyclePhase,
  type LinearLifecycleWriteError,
} from "../contracts/linear/lifecycle.js";

export type LinearLifecycleReadiness =
  | { status: "unavailable" }
  | { status: "unmapped" }
  | { status: "incomplete"; missing: LinearLifecyclePhase[] }
  | { status: "failing"; error: LinearLifecycleWriteError }
  | { status: "ready" };

export interface LinearLifecycleReadinessInput {
  lifecycle: IssueSourceLifecycle;
  error: LinearLifecycleWriteError | null;
  /** False while the integration cannot be read, so a mapping can be neither shown nor trusted. */
  available: boolean;
}

export function projectLinearLifecycleReadiness(
  input: LinearLifecycleReadinessInput,
): LinearLifecycleReadiness {
  if (!input.available) return { status: "unavailable" };
  const missing = LINEAR_LIFECYCLE_PHASES.filter((phase) => input.lifecycle[phase] === null);
  if (missing.length === LINEAR_LIFECYCLE_PHASES.length) return { status: "unmapped" };
  // Only a failure whose phase is still mapped is live; unmapping the phase already explains the silence.
  if (input.error !== null && input.lifecycle[input.error.phase] !== null) {
    return { status: "failing", error: input.error };
  }
  if (missing.length > 0) return { status: "incomplete", missing };
  return { status: "ready" };
}
