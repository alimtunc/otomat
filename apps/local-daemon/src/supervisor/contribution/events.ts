import { getRunContribution, type RunContributionRow } from "@otomat/db";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";

import type { SupervisorState } from "../state.js";
import { SUPERVISOR_ADAPTER } from "../types.js";

/** Anchors the message in the run's ledger so the conversation and the agent's activity share one ordering. */
export function emitContributionEvent(state: SupervisorState, row: RunContributionRow): void {
  emitLedgerEvent(
    state.db,
    state.dataDir,
    row.run_id,
    buildRuntimeEvent({
      runId: row.run_id,
      kind: "contribution",
      type: "run.contribution",
      source: "otomat",
      adapter: SUPERVISOR_ADAPTER,
      occurredAt: new Date().toISOString(),
      stepRunId: row.step_run_id,
      agentSessionId: row.agent_session_id,
      payload: {
        contribution_id: row.id,
        seq: row.seq,
        status: row.status,
        body: row.body,
        error: row.error,
        target_agent_session_id: row.target_agent_session_id,
        target_config_hash: row.target_config_json?.config_hash ?? null,
        target_runtime: row.target_config_json?.runtime ?? null,
        target_model: row.target_config_json?.model?.id ?? null,
      },
    }),
  );
}

/** The row is written by this module before every read, so an absent one is corruption, not an expected state. */
export function requireRunContribution(state: SupervisorState, id: string): RunContributionRow {
  const row = getRunContribution(state.db, id);
  if (!row) throw new Error(`contribution ${id} vanished from its own run`);
  return row;
}

export function emitContributionEvents(state: SupervisorState, ids: readonly string[]): void {
  for (const id of ids) emitContributionEvent(state, requireRunContribution(state, id));
}
