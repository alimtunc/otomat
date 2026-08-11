import {
  claimRunContributions,
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
import { canFollowUpRun, isCompeteLoser, latestSessionForStep } from "@otomat/domain";

import { createRuntimeAdapter, type KnownRuntimeId } from "#runtime";

import { failureReason } from "../fail-run.js";
import { spawnTurn } from "../lifecycle.js";
import { resolveSessionResumeTurn, RunNotResumableError, type ResumeTurn } from "../resume.js";
import { clearWorkerStartEvidence } from "../start-gate.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { emitContributionEvents } from "./events.js";

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

/** Claims the batch, hands it to one resume turn of its own step, and lets the spawn resolve it. */
async function sendBatch(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  batch: readonly RunContributionRow[],
): Promise<void> {
  const ids = batch.map((row) => row.id);
  let turn: ResumeTurn;
  try {
    // The batch is the whole prompt here; the spawn composes it from what it finds claimed.
    turn = resolveSessionResumeTurn(state, run, session, "");
    requireSteerableRuntime(turn.context.runtime, run.id);
  } catch (error) {
    if (!(error instanceof RunNotResumableError)) throw error;
    assertContributionTransitions(batch, "failed");
    failRunContributionDelivery(state.db, ids, failureReason(error));
    emitContributionEvents(state, ids);
    return;
  }

  clearWorkerStartEvidence(turn.context.agentSessionDir);
  claimRunContributions(state.db, ids, turn.context.agentSessionId);
  try {
    await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  } catch (error) {
    // The spawn already resolved the carried batch as failed; the run's own settle reports the turn.
    console.error(`[otomat] contribution delivery on run ${run.id} could not start`, error);
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
    if (!step || isCompeteLoser(step, groups)) continue;
    const session = steerableSessionForStep(sessions, step.id);
    if (session) return { kind: "send", stepRunId: step.id, session };
    if (latestSessionForStep(sessions, step.id)) {
      return {
        kind: "unreachable",
        stepRunId: step.id,
        reason: `step ${step.id} has no provider session to resume`,
      };
    }
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

    const ids = batch.map((row) => row.id);
    assertContributionTransitions(batch, "failed");
    failRunContributionDelivery(state.db, ids, target.reason);
    emitContributionEvents(state, ids);
    queued = listClaimableRunContributions(state.db, runId);
  }
}
