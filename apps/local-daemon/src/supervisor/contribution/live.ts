import {
  claimRunContributions,
  markRunContributionsDelivered,
  releaseRunContributionClaims,
  type AgentSessionRow,
  type RunContributionRow,
} from "@otomat/db";

import { sessionDir } from "#events";

import { awaitLiveInputReceipts, appendLiveInput, liveInputIds } from "../live-input.js";
import type { SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { emitContributionEvents } from "./events.js";

/** The turn a live delivery writes into: its own worker still owns the provider process. */
export interface LiveTarget {
  session: AgentSessionRow;
  /** Resolves when that worker is gone, which is the moment an unanswered message can no longer reach it. */
  exited: Promise<unknown>;
}

export function inflightLiveTarget(
  state: SupervisorState,
  runId: string,
  session: AgentSessionRow,
): LiveTarget | null {
  const handle = state.inflight.get(session.id);
  if (handle === undefined || handle.runId !== runId) return null;
  return { session, exited: handle.proc.exited };
}

/**
 * Writes an already-persisted batch into the running invocation in `seq` order: a
 * worker-accepted write is the only path to `delivered`, anything else returns to
 * the queue for the existing resume. Answers whether any message left the queue,
 * so a draining caller cannot loop on a channel that refuses everything.
 */
export async function deliverLiveContributions(
  state: SupervisorState,
  runId: string,
  target: LiveTarget,
  batch: readonly RunContributionRow[],
): Promise<boolean> {
  const dir = sessionDir(state.dataDir, runId, target.session.id);
  const ids = batch.map((row) => row.id);
  claimRunContributions(state.db, ids, target.session.id);
  // A row released after a receipt timeout comes back through here while the worker still runs; re-appending it would hand the provider the same message twice.
  const inboxed = liveInputIds(dir);
  // The channel is written before the ledger is told about it: a failed event must not cost the worker its message.
  for (const row of batch) {
    if (!inboxed.has(row.id)) appendLiveInput(dir, { kind: "message", id: row.id, body: row.body });
  }
  emitContributionEvents(state, ids);

  const { receipts } = await awaitLiveInputReceipts(dir, ids, target.exited);
  const accepted = batch.filter((row) => receipts.get(row.id) === null);
  const refused = batch.filter((row) => receipts.get(row.id) !== null);

  if (refused.length > 0) {
    for (const row of refused) {
      const error = receipts.get(row.id);
      if (error === undefined) continue;
      console.error(`[otomat] live input refused contribution ${row.id}: ${error}`);
    }
    releaseRunContributionClaims(
      state.db,
      refused.map((row) => row.id),
    );
  }
  if (accepted.length > 0) {
    assertContributionTransitions(accepted, "delivered");
    markRunContributionsDelivered(
      state.db,
      accepted.map((row) => row.id),
      new Date().toISOString(),
    );
  }
  emitContributionEvents(state, ids);
  return accepted.length > 0;
}
