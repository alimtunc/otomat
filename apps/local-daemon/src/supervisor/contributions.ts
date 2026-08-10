import { randomUUID } from "node:crypto";

import {
  appendRunContribution,
  getRun,
  getRunContribution,
  listClaimedRunContributions,
  listQueuedRunContributions,
  markRunContributionsSent,
  releaseRunContributionClaims,
  requeueRunContribution,
  type Db,
  type RunContributionRow,
} from "@otomat/db";
import { canFollowUpRun, isRunContributionRetriable } from "@otomat/domain";

import { sessionDir } from "#events";

import {
  emitContributionEvent,
  requireRunContribution,
  sendBatch,
} from "./contribution-delivery.js";
import { workerConsumedStartGate } from "./start-gate.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { assertContributionTransitions } from "./transitions.js";

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
