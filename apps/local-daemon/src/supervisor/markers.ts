import type { ProviderLimit, RunSettledState, RunState, StepProviderWait } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER, type ReconcileClassification } from "./types.js";

export interface SessionRef {
  runId: string;
  stepRunId: string | null;
  agentSessionId: string | null;
}

/** What one scheduled resume attempt did; the sweep and the journal agree on this single set. */
export type ProviderResumeOutcome = "resumed" | "refused";

type RunLifecyclePayload =
  | {
      phase: "final";
      final_status: RunSettledState;
      provider_session_id: string | null;
      provider_limit: ProviderLimit | null;
      event_count: number;
    }
  | { phase: "settled"; run_status: RunState }
  | ({ phase: "provider_wait" } & StepProviderWait)
  | { phase: "provider_resume"; resume_at: string; outcome: ProviderResumeOutcome; detail: string }
  | { phase: "reopened"; from_status: RunSettledState; step_name: string }
  | { phase: "abandoned"; branch: string }
  | { phase: "workspace_cleaned"; branch: string; worktree_path: string };

function lifecycleEvent(
  ref: SessionRef,
  payload: RunLifecyclePayload,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    ...ref,
    kind: payload.phase,
    type: "run.lifecycle",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    payload,
  });
}

/** Durable completion sentinel a worker appends as the last `events.jsonl` line, so a restarted daemon can tell a finished run from a torn one. */
export function buildTerminalMarker(
  ref: SessionRef,
  finalStatus: RunSettledState,
  providerSessionId: string | null,
  providerLimit: ProviderLimit | null,
  eventCount: number,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    ref,
    {
      phase: "final",
      final_status: finalStatus,
      provider_session_id: providerSessionId,
      provider_limit: providerLimit,
      event_count: eventCount,
    },
    occurredAt,
  );
}

/** Where the step's quota wait stands now: journaled on detection and on every schedule change, so a cancelled schedule reads as `resume_at: null`. */
export function buildProviderWaitEvent(
  ref: SessionRef,
  wait: StepProviderWait,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(ref, { phase: "provider_wait", ...wait }, occurredAt);
}

export function buildProviderResumeEvent(
  ref: SessionRef,
  resumeAt: string,
  outcome: ProviderResumeOutcome,
  detail: string,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    ref,
    { phase: "provider_resume", resume_at: resumeAt, outcome, detail },
    occurredAt,
  );
}

/**
 * The run's own canonical status, appended whenever a settle leaves it resting.
 * A terminal marker only ever spoke for one turn, so a `completed` turn must
 * never stand as the last word on a run its plan left failed.
 */
export function buildRunLandingEvent(
  ref: SessionRef,
  runStatus: RunState,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(ref, { phase: "settled", run_status: runStatus }, occurredAt);
}

export function buildRunReopenedEvent(
  ref: SessionRef,
  fromStatus: RunSettledState,
  stepName: string,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    ref,
    { phase: "reopened", from_status: fromStatus, step_name: stepName },
    occurredAt,
  );
}

/** Audit trail of the one manual closure: the cycle ends here, and the branch it names stays on disk. */
export function buildAbandonedEvent(
  runId: string,
  branch: string,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    { runId, stepRunId: null, agentSessionId: null },
    { phase: "abandoned", branch },
    occurredAt,
  );
}

export function buildWorkspaceCleanedEvent(
  runId: string,
  branch: string,
  worktreePath: string,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    { runId, stepRunId: null, agentSessionId: null },
    { phase: "workspace_cleaned", branch, worktree_path: worktreePath },
    occurredAt,
  );
}

/** Audit event appended on boot recording how reconciliation classified a torn run and whether an orphan process group was terminated. */
export function buildReconciledEvent(
  ref: SessionRef,
  classification: ReconcileClassification,
  reason: string,
  providerSessionId: string | null,
  orphanTerminated: boolean,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    ...ref,
    kind: "reconciled",
    type: "system.reconciled",
    source: "system",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    payload: {
      classification,
      reason,
      provider_session_id: providerSessionId,
      orphan_terminated: orphanTerminated,
    },
  });
}
