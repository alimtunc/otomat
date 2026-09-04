import {
  answerRunInteraction as writeRunInteractionAnswer,
  getRunInteraction,
  type RunInteractionRow,
} from "@otomat/db";
import {
  interactionAnswerRefusal,
  runInteractionMachine,
  type AnswerRunInteractionError,
  type RuntimeInteractionAnswer,
} from "@otomat/domain";

import { sessionDir } from "#events";

import { appendLiveInput, awaitLiveInputReceipts } from "../live-input.js";
import type { SupervisorState } from "../state.js";
import type { ProcessExit } from "../types.js";
import { emitInteractionOutcome } from "./events.js";
import { cancelSessionInteractions, ingestRunInteractions } from "./ingest.js";

const SESSION_GONE = "The turn that asked this question is no longer running.";

export class RunInteractionRefusedError extends Error {
  constructor(
    readonly code: AnswerRunInteractionError,
    message: string,
  ) {
    super(message);
    this.name = "RunInteractionRefusedError";
  }
}

function sameAnswer(
  left: RuntimeInteractionAnswer | null,
  right: RuntimeInteractionAnswer,
): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}

function requireOwnInteraction(
  state: SupervisorState,
  runId: string,
  interactionId: string,
): RunInteractionRow {
  const row = getRunInteraction(state.db, interactionId);
  if (!row || row.run_id !== runId) {
    throw new RunInteractionRefusedError(
      "run_interaction_not_found",
      `interaction ${interactionId} is not on this run`,
    );
  }
  return row;
}

/** A session with no live worker can take no answer at all, so every question it left open closes, not just the one being answered. */
function liveTurnExitOrCancel(
  state: SupervisorState,
  row: RunInteractionRow,
): Promise<ProcessExit> {
  const handle = state.inflight.get(row.agent_session_id);
  if (handle !== undefined && handle.runId === row.run_id) return handle.proc.exited;
  cancelSessionInteractions(
    state.db,
    state.dataDir,
    row.agent_session_id,
    SESSION_GONE,
    new Date().toISOString(),
  );
  ingestRunInteractions(state.db, row.run_id);
  throw new RunInteractionRefusedError("run_interaction_unreachable", SESSION_GONE);
}

function requireAnswerable(row: RunInteractionRow, answer: RuntimeInteractionAnswer): void {
  const refusal = interactionAnswerRefusal(
    { kind: row.kind, questions: row.questions_json },
    answer,
  );
  if (refusal !== null) throw new RunInteractionRefusedError(refusal.error, refusal.message);
  if (row.state === "canceled") {
    throw new RunInteractionRefusedError(
      "run_interaction_unreachable",
      row.canceled_reason ?? SESSION_GONE,
    );
  }
  if (row.state === "answered" && !sameAnswer(row.answer_json, answer)) {
    throw new RunInteractionRefusedError(
      "run_interaction_answered",
      `interaction ${row.id} was already answered differently, and a runtime takes one answer per question`,
    );
  }
}

/**
 * The single answer command: repeating the same answer returns the settled row
 * untouched. The channel write precedes the ledger write — a row marked answered
 * must never outlive an answer that was never handed over.
 */
export async function answerRunInteraction(
  state: SupervisorState,
  runId: string,
  interactionId: string,
  answer: RuntimeInteractionAnswer,
): Promise<RunInteractionRow> {
  const row = requireOwnInteraction(state, runId, interactionId);
  requireAnswerable(row, answer);
  if (row.state === "answered") return row;
  runInteractionMachine.transition(row.state, "answered");
  const exited = liveTurnExitOrCancel(state, row);

  const dir = sessionDir(state.dataDir, runId, row.agent_session_id);
  appendLiveInput(dir, {
    kind: "interaction_answer",
    id: row.id,
    request_id: row.provider_request_id,
    answer,
  });
  const { receipts, workerGone } = await awaitLiveInputReceipts(dir, [row.id], exited);
  const receipt = receipts.get(row.id);
  if (typeof receipt === "string") {
    throw new RunInteractionRefusedError("run_interaction_unreachable", receipt);
  }
  // An absent receipt from a live worker is durable and will still be read; from a dead one it never will be, so the row must stay pending for settle to cancel.
  if (receipt === undefined && workerGone) {
    throw new RunInteractionRefusedError("run_interaction_unreachable", SESSION_GONE);
  }

  // An absent row means a concurrent command already settled it, so the ledger must not record the same answer twice.
  const settled = writeRunInteractionAnswer(state.db, row.id, answer, new Date().toISOString());
  if (settled !== undefined) {
    emitInteractionOutcome(state.db, state.dataDir, settled, {
      outcome: "answered",
      request_id: settled.provider_request_id,
      answer,
    });
  }
  ingestRunInteractions(state.db, runId);
  return settled ?? requireOwnInteraction(state, runId, interactionId);
}
