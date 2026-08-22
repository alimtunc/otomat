import {
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  setStepNextTurnConfig,
  type StepRunRow,
} from "@otomat/db";
import type { NEXT_TURN_MODEL_ERRORS, ProviderOptions } from "@otomat/domain";

import { reviseAgentConfigForTurn } from "#agents";
import { emitLedgerEvent } from "#events";
import {
  buildRuntimeEvent,
  describeRuntimeResumeModelCapability,
  isKnownRuntimeId,
} from "#runtime";

import type { SupervisorState } from "./state.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

export type NextTurnModelErrorCode = (typeof NEXT_TURN_MODEL_ERRORS)[number];

export class NextTurnModelError extends Error {
  constructor(
    readonly code: NextTurnModelErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NextTurnModelError";
  }
}

export function setNextTurnModel(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
  sessionId: string,
  currentConfigHash: string,
  model: string,
  options: ProviderOptions,
): StepRunRow {
  const run = getRun(state.db, runId);
  const step = getStepRun(state.db, stepRunId);
  if (!run || !step || step.run_id !== runId) {
    throw new NextTurnModelError("step_not_found", `step ${stepRunId} is not on run ${runId}`);
  }
  const sessions = listAgentSessionsForRun(state.db, runId).filter(
    (candidate) => candidate.step_run_id === stepRunId,
  );
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    throw new NextTurnModelError(
      "session_not_found",
      `session ${sessionId} is not part of step ${stepRunId}`,
    );
  }
  if (sessions.at(-1)?.id !== sessionId) {
    throw new NextTurnModelError(
      "session_changed",
      "The selected participant has started a newer turn. Refresh before changing its model.",
    );
  }
  const runtime = session.agent_id;
  if (runtime === null || !isKnownRuntimeId(runtime)) {
    throw new NextTurnModelError(
      "resume_model_unsupported",
      `session ${sessionId} does not have a known runtime`,
    );
  }
  const capability = describeRuntimeResumeModelCapability(runtime);
  if (capability.status === "unsupported") {
    throw new NextTurnModelError("resume_model_unsupported", capability.reason);
  }
  const current = step.next_turn_config_json ?? session.config_json;
  if (!current) {
    throw new NextTurnModelError(
      "config_unavailable",
      `session ${sessionId} has no frozen execution configuration`,
    );
  }
  if (current.config_hash !== currentConfigHash) {
    throw new NextTurnModelError(
      "config_changed",
      "The next-turn configuration changed. Refresh it before choosing another model.",
    );
  }
  const next = reviseAgentConfigForTurn(current, model, options);
  const occurredAt = new Date().toISOString();
  const updated = setStepNextTurnConfig(state.db, stepRunId, next);
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildRuntimeEvent({
      runId,
      stepRunId,
      agentSessionId: sessionId,
      kind: "session",
      type: "session.model_override",
      source: "otomat",
      adapter: SUPERVISOR_ADAPTER,
      occurredAt,
      payload: {
        previous_model: current.model?.id ?? null,
        next_model: next.model?.id ?? null,
        previous_config_hash: current.config_hash,
        next_config_hash: next.config_hash,
        provenance: "turn",
        contribution_id: null,
      },
    }),
  );
  return updated;
}
