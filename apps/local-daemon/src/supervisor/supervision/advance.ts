import {
  listAgentSessionsForRun,
  listStepRunsForRun,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import {
  sessionsUsage,
  stepSessions,
  supervisionDecisionsFor,
  supervisionEntries,
  supervisionSessionIds,
  type EventEnvelope,
  type Supervision,
  type SupervisionEntry,
} from "@otomat/domain";

import { emitLedgerEvent, readRunEvents } from "#events";

import { failureReason } from "../fail-run.js";
import { spawnTurn } from "../lifecycle.js";
import { insertSessionResumeTurn } from "../resume.js";
import type { SupervisorState } from "../state.js";
import { driveRunTo, driveStepTo } from "../transitions.js";
import { buildSupervisionEvent } from "./events.js";
import { spawnSupervisionTurn } from "./turn.js";

function park(state: SupervisorState, run: RunRow, step: StepRunRow, reason: string): void {
  const now = new Date().toISOString();
  emitLedgerEvent(
    state.db,
    state.dataDir,
    run.id,
    buildSupervisionEvent(
      { runId: run.id, stepRunId: step.id, agentSessionId: null },
      { state: "unavailable", reason },
      now,
    ),
  );
  driveRunTo(state.db, run.id, run.status, "awaiting_human", now);
}

/** The instructions ride on a new turn of the same step, resuming the conversation its own profile already froze. */
async function remediate(
  state: SupervisorState,
  run: RunRow,
  step: StepRunRow,
  instructions: string,
): Promise<void> {
  const session = stepSessions(listAgentSessionsForRun(state.db, run.id), step.id).at(-1);
  if (!session) {
    park(state, run, step, "this step has no turn a supervisor's instructions could reach");
    return;
  }
  const turn = insertSessionResumeTurn(state, run, session, session.config_json, instructions, []);
  await spawnTurn(
    state,
    turn.context,
    turn.providerSessionId === null ? "run" : "resume",
    turn.providerSessionId,
  );
}

/** An unavailable supervisor or an unusable session owes the operator a decision, never a pass. */
async function parkOnFailure(
  state: SupervisorState,
  run: RunRow,
  step: StepRunRow,
  act: () => Promise<void>,
): Promise<void> {
  try {
    await act();
  } catch (error) {
    park(state, run, step, failureReason(error));
  }
}

async function actOn(
  state: SupervisorState,
  run: RunRow,
  supervision: Supervision,
  step: StepRunRow,
  entry: SupervisionEntry,
  events: readonly EventEnvelope[],
): Promise<boolean> {
  if (
    entry.state === "unavailable" ||
    (entry.state === "decided" && entry.decision.decision === "blocked")
  ) {
    driveRunTo(state.db, run.id, run.status, "awaiting_human", new Date().toISOString());
    return true;
  }
  const supervisors = supervisionSessionIds(listAgentSessionsForRun(state.db, run.id));
  const spent = sessionsUsage(events, supervisors, true).costUsd ?? 0;
  if (supervision.budget_usd !== null && spent >= supervision.budget_usd) {
    park(state, run, step, "the supervision budget for this run is spent");
    return true;
  }
  if (entry.state === "pending") {
    await parkOnFailure(state, run, step, () =>
      spawnSupervisionTurn(state, run, step, supervision),
    );
    return true;
  }
  if (entry.decision.decision !== "needs_changes") return false;
  const rounds = supervisionDecisionsFor(events, step.id).length;
  if (rounds >= supervision.max_loops) {
    park(
      state,
      run,
      step,
      `this step has been through ${rounds} supervision rounds, its configured limit`,
    );
    return true;
  }
  const { instructions } = entry.decision;
  await parkOnFailure(state, run, step, () => remediate(state, run, step, instructions));
  return true;
}

/** `false` means supervision has nothing outstanding and the plan may start its next node. */
export async function advanceSupervision(
  state: SupervisorState,
  run: RunRow,
  supervision: Supervision,
): Promise<boolean> {
  const events = readRunEvents(state.db, run.id);
  const entries = supervisionEntries(events);
  for (const step of listStepRunsForRun(state.db, run.id)) {
    const entry = entries.get(step.id);
    if (entry === undefined || step.status !== "awaiting_human") continue;
    if (entry.state === "decided" && entry.decision.decision === "pass") {
      driveStepTo(state.db, step.id, step.status, "succeeded");
      continue;
    }
    return await actOn(state, run, supervision, step, entry, events);
  }
  return false;
}
