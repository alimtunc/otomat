import type { Db, RunInteractionRow } from "@otomat/db";
import type { RuntimeInteractionOutcome } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER } from "../types.js";

/** Anchors the outcome in the run's ledger so the conversation shows the answer where the question was asked. */
export function emitInteractionOutcome(
  db: Db,
  dataDir: string,
  row: RunInteractionRow,
  outcome: RuntimeInteractionOutcome,
): void {
  emitLedgerEvent(
    db,
    dataDir,
    row.run_id,
    buildRuntimeEvent({
      runId: row.run_id,
      kind: "interaction",
      type: "runtime.interaction_answered",
      source: "otomat",
      adapter: SUPERVISOR_ADAPTER,
      occurredAt: new Date().toISOString(),
      stepRunId: row.step_run_id,
      agentSessionId: row.agent_session_id,
      payload: { ...outcome, interaction_id: row.id },
    }),
  );
}
