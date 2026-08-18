import type { LinearLifecyclePhase, LinearLifecycleSync } from "@otomat/domain";

/** A broken tracker must never break the transition that triggered the signal. */
export function signalIssueLifecycle(
  sync: LinearLifecycleSync | null | undefined,
  issueId: string,
  phase: LinearLifecyclePhase,
  runId: string | null,
): void {
  if (!sync) return;
  try {
    sync({ issue_id: issueId, phase, run_id: runId });
  } catch (error) {
    console.error(`[otomat] issue ${issueId} lifecycle signal (${phase}) failed`, error);
  }
}
