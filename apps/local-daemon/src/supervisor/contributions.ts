import { randomUUID } from "node:crypto";

import {
  appendRunContribution,
  claimRunContributions,
  failRunContributionDelivery,
  getRun,
  getRunContribution,
  listClaimedRunContributions,
  listQueuedRunContributions,
  markRunContributionsSent,
  releaseRunContributionClaims,
  requeueRunContribution,
  type Db,
  type RunContributionRow,
  type RunRow,
} from "@otomat/db";
import { canFollowUpRun, isRunContributionRetriable } from "@otomat/domain";

import { emitLedgerEvent, sessionDir } from "#events";
import { buildRuntimeEvent } from "#runtime";

import { buildContributionPrompt } from "./contribution-prompt.js";
import { spawnTurn } from "./lifecycle.js";
import { resolveResumeTurn, RunNotResumableError, type ResumeTurn } from "./resume.js";
import { clearWorkerStartEvidence, workerConsumedStartGate } from "./start-gate.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { assertContributionTransitions } from "./transitions.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

/** No such message on this run — a bad id, not a conflict. */
export class RunContributionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunContributionNotFoundError";
  }
}

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

/** The row is written by this module before every read, so an absent one is corruption, not an expected state. */
function requireRunContribution(state: SupervisorState, id: string): RunContributionRow {
  const row = getRunContribution(state.db, id);
  if (!row) throw new Error(`contribution ${id} vanished from its own run`);
  return row;
}

function emitContributionEvents(state: SupervisorState, ids: readonly string[]): void {
  for (const id of ids) emitContributionEvent(state, requireRunContribution(state, id));
}

/** Claims the batch, hands it to one resume turn, and resolves it from what the spawn actually did. */
async function sendBatch(
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

  // Before the claim is durable, so a crash while waiting for a slot leaves no stale proof of an earlier turn.
  clearWorkerStartEvidence(turn.context.agentSessionDir);
  claimRunContributions(state.db, ids, turn.context.agentSessionId);
  let started: boolean;
  try {
    started = await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  } catch (error) {
    // `spawnTurn` only throws before the worker starts, so nothing reached the provider and a retry cannot duplicate it.
    assertContributionTransitions(queued, "failed");
    failRunContributionDelivery(state.db, ids, reason(error));
    emitContributionEvents(state, ids);
    return;
  }
  if (!started) {
    // `false` means no worker ever started, so the batch is honestly still queued.
    releaseRunContributionClaims(state.db, ids);
    return;
  }
  assertContributionTransitions(queued, "sent");
  markRunContributionsSent(state.db, ids, new Date().toISOString());
  emitContributionEvents(state, ids);
}

/** The single delivery mechanism — API, post-settle chain and "deliver now" all land here; a busy or unresumable run just keeps its queue. */
export async function deliverQueuedContributions(
  state: SupervisorState,
  runId: string,
): Promise<void> {
  if (state.shuttingDown || state.aborting.has(runId) || state.delivering.has(runId)) return;
  const queued = listQueuedRunContributions(state.db, runId);
  if (queued.length === 0) return;
  const run = getRun(state.db, runId);
  if (!run || !canFollowUpRun(run.status) || hasRunActivity(state, runId)) return;

  state.delivering.add(runId);
  try {
    await sendBatch(state, run, queued);
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
  return requireRunContribution(state, row.id);
}

/** Re-queues a failed message that never reached the provider, then retries the run's queue. */
export async function retryRunContribution(
  state: SupervisorState,
  runId: string,
  contributionId: string,
): Promise<RunContributionRow> {
  const row = getRunContribution(state.db, contributionId);
  if (!row || row.run_id !== runId) {
    throw new RunContributionNotFoundError(`contribution ${contributionId} is not on this run`);
  }
  if (!isRunContributionRetriable(row)) {
    throw new RunContributionNotRetriableError(
      row.delivered_at === null
        ? `contribution ${contributionId} is ${row.status}, not failed`
        : `contribution ${contributionId} already reached the agent and must not be sent twice`,
    );
  }
  assertContributionTransitions([row], "queued");
  requeueRunContribution(state.db, contributionId);
  await deliverQueuedContributions(state, runId);
  return requireRunContribution(state, contributionId);
}

/**
 * Boot pass over claims a crash left behind. The turn's own start gate is the
 * evidence: only a gate the worker took proves the batch reached a provider, so
 * anything else returns the messages to the queue instead of burying them as
 * delivered. A session row's `pid` survives every turn and can prove nothing.
 */
export function reconcileContributionClaims(db: Db, dataDir: string, now: string): void {
  for (const row of listClaimedRunContributions(db)) {
    const sessionId = row.agent_session_id;
    if (sessionId === null) continue;
    if (!workerConsumedStartGate(sessionDir(dataDir, row.run_id, sessionId))) {
      releaseRunContributionClaims(db, [row.id]);
      continue;
    }
    assertContributionTransitions([row], "sent");
    markRunContributionsSent(db, [row.id], now);
  }
}
