import {
  claimRunContributions,
  failRunContributionDelivery,
  getRunContribution,
  markRunContributionsSent,
  releaseRunContributionClaims,
  type RunContributionRow,
  type RunRow,
} from "@otomat/db";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";

import { buildContributionPrompt } from "./contribution-prompt.js";
import { spawnTurn } from "./lifecycle.js";
import { resolveResumeTurn, RunNotResumableError, type ResumeTurn } from "./resume.js";
import { clearWorkerStartEvidence } from "./start-gate.js";
import type { SupervisorState } from "./state.js";
import { assertContributionTransitions } from "./transitions.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
      agentSessionId: row.agent_session_id,
      payload: { contribution_id: row.id, seq: row.seq, status: row.status, body: row.body },
    }),
  );
}

/** The row is written by this module before every read, so an absent one is corruption, not an expected state. */
export function requireRunContribution(state: SupervisorState, id: string): RunContributionRow {
  const row = getRunContribution(state.db, id);
  if (!row) throw new Error(`contribution ${id} vanished from its own run`);
  return row;
}

function emitContributionEvents(state: SupervisorState, ids: readonly string[]): void {
  for (const id of ids) emitContributionEvent(state, requireRunContribution(state, id));
}

/** Claims the batch, hands it to one resume turn, and resolves it from what the spawn actually did. */
export async function sendBatch(
  state: SupervisorState,
  run: RunRow,
  queued: readonly RunContributionRow[],
): Promise<void> {
  const ids = queued.map((row) => row.id);
  let turn: ResumeTurn;
  try {
    turn = resolveResumeTurn(state, run, buildContributionPrompt(queued.map((row) => row.body)));
  } catch (error) {
    if (!(error instanceof RunNotResumableError)) throw error;
    assertContributionTransitions(queued, "failed");
    failRunContributionDelivery(state.db, ids, reason(error));
    emitContributionEvents(state, ids);
    return;
  }

  clearWorkerStartEvidence(turn.context.agentSessionDir);
  claimRunContributions(state.db, ids, turn.context.agentSessionId);
  let started: boolean;
  try {
    started = await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  } catch (error) {
    assertContributionTransitions(queued, "failed");
    failRunContributionDelivery(state.db, ids, reason(error));
    emitContributionEvents(state, ids);
    return;
  }
  if (!started) {
    releaseRunContributionClaims(state.db, ids);
    return;
  }
  assertContributionTransitions(queued, "sent");
  markRunContributionsSent(state.db, ids, new Date().toISOString());
  emitContributionEvents(state, ids);
}
