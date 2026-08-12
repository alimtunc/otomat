import {
  cancelRunContribution as writeRunContributionCanceled,
  failRunContributionDelivery,
  getRun,
  listAgentSessionsForRun,
  listClaimableRunContributions,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type RunContributionRow,
  type RunRow,
} from "@otomat/db";
import {
  canFollowUpRun,
  latestSessionForStep,
  resolveStepContributionRoute,
  runMachine,
} from "@otomat/domain";

import { createRuntimeAdapter, type KnownRuntimeId } from "#runtime";

import { failureReason } from "../fail-run.js";
import { spawnTurn } from "../lifecycle.js";
import { resolveSessionResumeTurn, RunNotResumableError, type ResumeTurn } from "../resume.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { emitContributionEvent, emitContributionEvents, requireRunContribution } from "./events.js";

/** A runtime with no steering channel cannot take a follow-up at all; saying so beats queueing forever. */
function requireSteerableRuntime(runtime: KnownRuntimeId, runId: string): void {
  if (createRuntimeAdapter(runtime).capabilities.steering === "unsupported") {
    throw new RunNotResumableError(`run ${runId} runtime "${runtime}" does not support steering`);
  }
}

/** The session a delivery would re-enter: this step's newest one the provider can still be resumed through. */
function steerableSessionForStep(
  sessions: readonly AgentSessionRow[],
  stepRunId: string,
): AgentSessionRow | undefined {
  const resumable = sessions.filter((session) => session.provider_session_id !== null);
  return latestSessionForStep(resumable, stepRunId);
}

function failBatch(
  state: SupervisorState,
  batch: readonly RunContributionRow[],
  reason: string,
): void {
  if (batch.length === 0) return;
  const ids = batch.map((row) => row.id);
  assertContributionTransitions(batch, "failed");
  failRunContributionDelivery(state.db, ids, reason);
  emitContributionEvents(state, ids);
}

/** Hands the step's queue to one resume turn of its own session; `spawnTurn` claims it and resolves it from what the spawn did. */
async function sendBatch(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  batch: readonly RunContributionRow[],
): Promise<void> {
  let turn: ResumeTurn;
  try {
    turn = resolveSessionResumeTurn(state, run, session, null);
    requireSteerableRuntime(turn.context.runtime, run.id);
  } catch (error) {
    if (!(error instanceof RunNotResumableError)) throw error;
    failBatch(state, batch, failureReason(error));
    return;
  }

  try {
    await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  } catch (error) {
    // `spawnTurn` resolves whatever it claimed; a throw before that leaves rows queued, and silence would strand them.
    const stranded = batch
      .map((row) => requireRunContribution(state, row.id))
      .filter((row) => row.status === "queued" && row.agent_session_id === null);
    failBatch(state, stranded, failureReason(error));
  }
}

/** A step that has yet to start keeps its messages for its own first turn; only one whose session can no longer be resumed fails them. */
type DeliveryTarget =
  | { kind: "send"; stepRunId: string; session: AgentSessionRow }
  | { kind: "unreachable"; stepRunId: string; reason: string };

function nextDeliveryTarget(
  db: SupervisorState["db"],
  runId: string,
  queued: readonly RunContributionRow[],
): DeliveryTarget | null {
  const steps = listStepRunsForRun(db, runId);
  const sessions = listAgentSessionsForRun(db, runId);
  const groups = listCompeteGroupsForRun(db, runId);
  for (const row of queued) {
    const step = steps.find((candidate) => candidate.id === row.step_run_id);
    if (!step) continue;
    // One routing rule for accepting a message and for delivering it, so the two can never disagree.
    const route = resolveStepContributionRoute(step, sessions, groups);
    if (route === null) {
      return {
        kind: "unreachable",
        stepRunId: step.id,
        reason: `step ${step.id} is ${step.status} and will not run another turn`,
      };
    }
    if (route === "first_turn") continue;
    const session = steerableSessionForStep(sessions, step.id);
    if (session) return { kind: "send", stepRunId: step.id, session };
    return {
      kind: "unreachable",
      stepRunId: step.id,
      reason: `step ${step.id} has no provider session to resume`,
    };
  }
  return null;
}

/** The single delivery mechanism; one step's batch travels per turn because the run owns a single worktree. */
export async function deliverQueuedContributions(
  state: SupervisorState,
  runId: string,
): Promise<void> {
  if (state.shuttingDown || state.aborting.has(runId) || state.delivering.has(runId)) return;
  let queued = listClaimableRunContributions(state.db, runId);
  if (queued.length === 0) return;
  const run = getRun(state.db, runId);
  if (!run || !canFollowUpRun(run.status) || hasRunActivity(state, runId)) return;

  // Failing an unreachable step must not strand a later step that can still be sent, so the scan resumes past it.
  while (queued.length > 0) {
    const target = nextDeliveryTarget(state.db, runId, queued);
    if (target === null) return;
    const batch = queued.filter((row) => row.step_run_id === target.stepRunId);

    if (target.kind === "send") {
      state.delivering.add(runId);
      try {
        await sendBatch(state, run, target.session, batch);
      } finally {
        state.delivering.delete(runId);
      }
      return;
    }

    failBatch(state, batch, target.reason);
    queued = listClaimableRunContributions(state.db, runId);
  }
}

/** A terminal run produces no further turn, so its unclaimed queue is withdrawn rather than left waiting forever. */
export function cancelUndeliverableContributions(state: SupervisorState, runId: string): void {
  const run = getRun(state.db, runId);
  if (!run || !runMachine.isTerminal(run.status)) return;
  const now = new Date().toISOString();
  for (const row of listClaimableRunContributions(state.db, runId)) {
    assertContributionTransitions([row], "canceled");
    writeRunContributionCanceled(state.db, row.id, now);
    emitContributionEvent(state, requireRunContribution(state, row.id));
  }
}
