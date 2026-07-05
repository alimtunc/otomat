import type { RunTerminalState } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER, type ReconcileClassification } from "./types.js";

export interface SessionRef {
  runId: string;
  stepRunId: string | null;
  agentSessionId: string | null;
}

/** Durable completion sentinel a worker appends as the last `events.jsonl` line, so a restarted daemon can tell a finished run from a torn one. */
export function buildTerminalMarker(
  ref: SessionRef,
  finalStatus: RunTerminalState,
  providerSessionId: string | null,
  eventCount: number,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId: ref.runId,
    kind: "final",
    type: "run.lifecycle",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    stepRunId: ref.stepRunId,
    agentSessionId: ref.agentSessionId,
    payload: {
      phase: "final",
      final_status: finalStatus,
      provider_session_id: providerSessionId,
      event_count: eventCount,
    },
  });
}

export function buildReconciledEvent(
  ref: SessionRef,
  classification: ReconcileClassification,
  reason: string,
  providerSessionId: string | null,
  orphanTerminated: boolean,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId: ref.runId,
    kind: "reconciled",
    type: "system.reconciled",
    source: "system",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    stepRunId: ref.stepRunId,
    agentSessionId: ref.agentSessionId,
    payload: {
      classification,
      reason,
      provider_session_id: providerSessionId,
      orphan_terminated: orphanTerminated,
    },
  });
}
