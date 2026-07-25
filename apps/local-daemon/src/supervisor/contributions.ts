import { randomUUID } from "node:crypto";

import {
  appendRunContribution,
  claimRunContributions,
  getAgentSession,
  getRun,
  getRunContribution,
  listClaimedRunContributions,
  listRunContributionsByStatus,
  markRunContributionsFailed,
  markRunContributionsSent,
  releaseRunContributionClaim,
  requeueRunContribution,
  type Db,
  type RunContributionRow,
} from "@otomat/db";
import { canFollowUpRun } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";

import { buildContributionPrompt } from "./contribution-prompt.js";
import { spawnTurn } from "./lifecycle.js";
import { resolveResumeTurn, RunNotResumableError } from "./resume.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

/** A retry the caller got wrong: the contribution is not failed, or it already reached the provider. */
export class RunContributionNotRetriableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionNotRetriableError";
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Anchors the message in the run's ledger so the conversation and the agent's activity share one ordering. */
function emitContributionEvent(state: SupervisorState, row: RunContributionRow): void {
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

function emitForIds(state: SupervisorState, ids: readonly string[]): void {
  for (const id of ids) {
    const row = getRunContribution(state.db, id);
    if (row) emitContributionEvent(state, row);
  }
}

/**
 * Hands the run's queued messages to one resume turn, in send order. It is the
 * single delivery mechanism: the contribution API, the post-settle chain and an
 * explicit "deliver now" all call it, and it is a no-op while the run is busy or
 * has no resting session to resume — those messages simply stay queued.
 */
export async function deliverQueuedContributions(
  state: SupervisorState,
  runId: string,
): Promise<void> {
  if (state.shuttingDown || state.aborting.has(runId) || state.delivering.has(runId)) return;
  const queued = listRunContributionsByStatus(state.db, runId, "queued");
  if (queued.length === 0) return;
  const run = getRun(state.db, runId);
  if (!run || !canFollowUpRun(run.status) || hasRunActivity(state, runId)) return;

  const ids = queued.map((row) => row.id);
  state.delivering.add(runId);
  try {
    let turn;
    try {
      turn = resolveResumeTurn(state, run, buildContributionPrompt(queued.map((row) => row.body)));
    } catch (error) {
      if (!(error instanceof RunNotResumableError)) throw error;
      markRunContributionsFailed(state.db, ids, reason(error));
      emitForIds(state, ids);
      return;
    }

    claimRunContributions(state.db, ids, turn.context.agentSessionId);
    try {
      await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
    } catch (error) {
      // The turn never launched, so nothing reached the provider and a retry cannot duplicate it.
      markRunContributionsFailed(state.db, ids, reason(error));
      emitForIds(state, ids);
      return;
    }
    markRunContributionsSent(state.db, ids, new Date().toISOString());
    emitForIds(state, ids);
  } finally {
    state.delivering.delete(runId);
  }
}

/** Persists one user message as `queued` — always — then tries to deliver it right away. */
export async function contributeToRun(
  state: SupervisorState,
  runId: string,
  body: string,
): Promise<RunContributionRow> {
  const row = appendRunContribution(state.db, { id: randomUUID(), run_id: runId, body });
  emitContributionEvent(state, row);
  await deliverQueuedContributions(state, runId);
  return getRunContribution(state.db, row.id) ?? row;
}

/** Re-queues a failed message that never reached the provider, then retries the run's queue. */
export async function retryRunContribution(
  state: SupervisorState,
  runId: string,
  contributionId: string,
): Promise<RunContributionRow> {
  const row = getRunContribution(state.db, contributionId);
  if (!row || row.run_id !== runId) {
    throw new RunContributionNotRetriableError(`contribution ${contributionId} is not on this run`);
  }
  if (row.status !== "failed") {
    throw new RunContributionNotRetriableError(
      `contribution ${contributionId} is ${row.status}, not failed`,
    );
  }
  if (row.delivered_at !== null) {
    throw new RunContributionNotRetriableError(
      `contribution ${contributionId} already reached the agent and must not be sent twice`,
    );
  }
  requeueRunContribution(state.db, contributionId);
  await deliverQueuedContributions(state, runId);
  return getRunContribution(state.db, contributionId) ?? row;
}

/**
 * Boot pass over claims a crash left behind. A claimed session with a recorded
 * pid proves its worker was launched carrying the batch, so those messages are
 * `sent` and the run's settle resolves them; without a pid nothing was launched
 * and the claim is dropped so the message stays honestly queued.
 */
export function reconcileContributionClaims(db: Db, now: string): void {
  for (const row of listClaimedRunContributions(db)) {
    const sessionId = row.agent_session_id;
    if (sessionId === null) continue;
    const session = getAgentSession(db, sessionId);
    if (session && session.pid !== null) markRunContributionsSent(db, [row.id], now);
    else releaseRunContributionClaim(db, row.id);
  }
}
