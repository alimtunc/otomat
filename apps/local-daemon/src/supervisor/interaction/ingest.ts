import {
  cancelRunInteractions,
  getRun,
  listPendingRunInteractions,
  listPendingRunInteractionsForSession,
  listStepRunsForRun,
  recordRunInteraction,
  type Db,
  type RunInteractionRow,
} from "@otomat/db";
import {
  runInteractionMachine,
  runtimeInteractionOutcomeSchema,
  runtimeInteractionRequestSchema,
  type EventEnvelope,
} from "@otomat/domain";

import { readRunEventsOfTypes } from "#events";

import { driveRunTo, driveStepTo } from "../transitions.js";
import { emitInteractionOutcome } from "./events.js";

const INTERACTION_EVENT_TYPES = [
  "runtime.interaction_requested",
  "runtime.interaction_answered",
] as const satisfies readonly EventEnvelope["type"][];

function recordRequest(db: Db, event: EventEnvelope): void {
  const request = runtimeInteractionRequestSchema.safeParse(event.payload);
  if (!request.success || event.step_run_id === null || event.agent_session_id === null) return;
  recordRunInteraction(db, {
    id: event.id,
    run_id: event.run_id,
    step_run_id: event.step_run_id,
    agent_session_id: event.agent_session_id,
    provider_request_id: request.data.request_id,
    kind: request.data.kind,
    prompt: request.data.prompt,
    tool: request.data.tool,
    options_json: request.data.options,
    requested_at: event.occurred_at,
  });
}

/** A runtime that withdrew its question; re-reading the same event changes nothing, because the write is scoped to a still-pending row. */
function withdrawRequest(db: Db, event: EventEnvelope, now: string): void {
  const outcome = runtimeInteractionOutcomeSchema.safeParse(event.payload);
  if (!outcome.success || outcome.data.outcome !== "canceled" || event.agent_session_id === null) {
    return;
  }
  const withdrawn = listPendingRunInteractionsForSession(db, event.agent_session_id).filter(
    (row) => row.provider_request_id === outcome.data.request_id,
  );
  for (const row of withdrawn) runInteractionMachine.transition(row.state, "canceled");
  cancelRunInteractions(
    db,
    withdrawn.map((row) => row.id),
    outcome.data.reason,
    now,
  );
}

/** A live turn blocked on a question rests the run and its step; nothing else in the plan may move while the provider waits. */
function reconcileWaitingStates(
  db: Db,
  runId: string,
  pending: readonly RunInteractionRow[],
): void {
  const run = getRun(db, runId);
  if (!run) return;
  const blocked = new Set(pending.map((row) => row.step_run_id));
  for (const step of listStepRunsForRun(db, runId)) {
    if (blocked.has(step.id) && step.status === "running") {
      driveStepTo(db, step.id, step.status, "awaiting_permission");
    }
    if (!blocked.has(step.id) && step.status === "awaiting_permission") {
      driveStepTo(db, step.id, step.status, "running");
    }
  }
  const target = blocked.size > 0 ? "awaiting_permission" : "running";
  const source = blocked.size > 0 ? "running" : "awaiting_permission";
  if (run.status === source) driveRunTo(db, runId, run.status, target, new Date().toISOString());
}

/**
 * Promotes the questions in the run's event stream into the durable rows the
 * operator answers, and rests the run while any stays open; the ledger is the
 * request's proof, so a repeated or post-restart pass reaches the same rows.
 */
export function ingestRunInteractions(db: Db, runId: string): void {
  const now = new Date().toISOString();
  for (const event of readRunEventsOfTypes(db, runId, INTERACTION_EVENT_TYPES)) {
    if (event.type === "runtime.interaction_requested") recordRequest(db, event);
    else withdrawRequest(db, event, now);
  }
  reconcileWaitingStates(db, runId, listPendingRunInteractions(db, runId));
}

/** Ends every question a settled session left open: its provider can no longer take an answer, so keeping it answerable would be a lie. */
export function cancelSessionInteractions(
  db: Db,
  dataDir: string,
  agentSessionId: string,
  reason: string,
  now: string,
): void {
  const pending = listPendingRunInteractionsForSession(db, agentSessionId);
  if (pending.length === 0) return;
  for (const row of pending) runInteractionMachine.transition(row.state, "canceled");
  cancelRunInteractions(
    db,
    pending.map((row) => row.id),
    reason,
    now,
  );
  for (const row of pending) {
    emitInteractionOutcome(db, dataDir, row, {
      outcome: "canceled",
      request_id: row.provider_request_id,
      reason,
    });
  }
}
