import { randomUUID } from "node:crypto";

import type { RunTerminalState } from "@otomat/domain";

import type { RuntimeEvent } from "#runtime";

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
  return {
    id: `${ref.runId}:final:${randomUUID()}`,
    run_id: ref.runId,
    step_run_id: ref.stepRunId,
    agent_session_id: ref.agentSessionId,
    type: "run.lifecycle",
    source: "otomat",
    occurred_at: occurredAt,
    payload: {
      fidelity: "parsed",
      adapter: SUPERVISOR_ADAPTER,
      phase: "final",
      final_status: finalStatus,
      provider_session_id: providerSessionId,
      event_count: eventCount,
    },
    raw_ref: null,
  };
}

export function buildReconciledEvent(
  ref: SessionRef,
  classification: ReconcileClassification,
  reason: string,
  providerSessionId: string | null,
  orphanTerminated: boolean,
  occurredAt: string,
): RuntimeEvent {
  return {
    id: `${ref.runId}:reconciled:${randomUUID()}`,
    run_id: ref.runId,
    step_run_id: ref.stepRunId,
    agent_session_id: ref.agentSessionId,
    type: "system.reconciled",
    source: "system",
    occurred_at: occurredAt,
    payload: {
      fidelity: "parsed",
      adapter: SUPERVISOR_ADAPTER,
      classification,
      reason,
      provider_session_id: providerSessionId,
      orphan_terminated: orphanTerminated,
    },
    raw_ref: null,
  };
}
