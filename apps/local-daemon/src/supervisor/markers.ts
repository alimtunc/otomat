import type { RunSettledState, RunState } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER, type ReconcileClassification } from "./types.js";

export interface SessionRef {
  runId: string;
  stepRunId: string | null;
  agentSessionId: string | null;
}

type RunLifecyclePayload =
  | {
      phase: "final";
      final_status: RunSettledState;
      provider_session_id: string | null;
      event_count: number;
    }
  | { phase: "settled"; run_status: RunState }
  | { phase: "reopened"; from_status: RunSettledState; step_name: string }
  | { phase: "abandoned"; branch: string };

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
  eventCount: number,
  occurredAt: string,
): RuntimeEvent {
  return lifecycleEvent(
    ref,
    {
      phase: "final",
      final_status: finalStatus,
      provider_session_id: providerSessionId,
      event_count: eventCount,
    },
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
