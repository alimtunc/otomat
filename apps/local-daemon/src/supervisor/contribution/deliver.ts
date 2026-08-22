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
import { canFollowUpRun, isRunSettled, resolveStepContributionRoute } from "@otomat/domain";

import { createRuntimeAdapter, type KnownRuntimeId } from "#runtime";

import { failureReason } from "../fail-run.js";
import { spawnTurn } from "../lifecycle.js";
import {
  insertSessionResumeTurn,
  requireResumeConfigSupport,
  resumableRuntime,
  RunNotResumableError,
  type ResumeTurn,
} from "../resume.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { assertContributionTransitions } from "../transitions.js";
import { emitContributionEvent, emitContributionEvents, requireRunContribution } from "./events.js";
import { deliverLiveContributions, inflightLiveTarget, type LiveTarget } from "./live.js";

/** A runtime with no steering channel cannot take a follow-up at all; saying so beats queueing forever. */
function requireSteerableRuntime(runtime: KnownRuntimeId, runId: string): void {
  if (createRuntimeAdapter(runtime).capabilities.steering === "unsupported") {
    throw new RunNotResumableError(`run ${runId} runtime "${runtime}" does not support steering`);
  }
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
    const config = batch[0]?.target_config_json;
    if (config === null || config === undefined) {
      throw new RunNotResumableError("the queued contribution has no frozen target configuration");
    }
    const runtime = resumableRuntime(state.db, run, session);
    if (runtime === null) {
      throw new RunNotResumableError(`session ${session.id} has no resumable runtime`);
    }
    requireSteerableRuntime(runtime, run.id);
    requireResumeConfigSupport(state.db, run, session, config);
    turn = insertSessionResumeTurn(
      state,
      run,
      session,
      config,
      null,
      batch.map((row) => row.id),
    );
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

function liveTarget(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  configHash: string,
): LiveTarget | null {
  if (session.config_json?.config_hash !== configHash) return null;
  const runtime = resumableRuntime(state.db, run, session);
  if (runtime === null || createRuntimeAdapter(runtime).capabilities.steering !== "live") {
    return null;
  }
  return inflightLiveTarget(state, run.id, session);
}

/** One turn carries one target, so the batch stops at the first message frozen against another session or configuration. */
function headTargetBatch(stepQueue: readonly RunContributionRow[]): RunContributionRow[] {
  const head = stepQueue[0];
  if (head === undefined) return [];
  const batch: RunContributionRow[] = [];
  for (const row of stepQueue) {
    if (
      row.target_agent_session_id !== head.target_agent_session_id ||
      row.target_config_json?.config_hash !== head.target_config_json?.config_hash
    ) {
      break;
    }
    batch.push(row);
  }
  return batch;
}

/** A step that has yet to start keeps its messages for its own first turn; only one whose session can no longer be resumed fails them. */
type DeliveryTarget =
  | { kind: "live"; stepRunId: string; live: LiveTarget }
  | { kind: "send"; stepRunId: string; session: AgentSessionRow }
  | { kind: "unreachable"; stepRunId: string; reason: string };

function nextDeliveryTarget(
  state: SupervisorState,
  run: RunRow,
  queued: readonly RunContributionRow[],
): DeliveryTarget | null {
  const { db } = state;
  const steps = listStepRunsForRun(db, run.id);
  const sessions = listAgentSessionsForRun(db, run.id);
  const groups = listCompeteGroupsForRun(db, run.id);
  for (const row of queued) {
    const step = steps.find((candidate) => candidate.id === row.step_run_id);
    if (!step) continue;
    // An operator-stopped step keeps its queue until an explicit message, retry or resume lifts the hold.
    if (state.stopHeld.has(step.id)) continue;
    // One routing rule for accepting a message and for delivering it, so the two can never disagree.
    const route = resolveStepContributionRoute(step, sessions, groups);
    if (route === "first_turn") continue;
    const targetSession = sessions.find(
      (candidate) => candidate.id === row.target_agent_session_id,
    );
    const configHash = row.target_config_json?.config_hash;
    if (route === "steering" && targetSession !== undefined && configHash !== undefined) {
      const live = liveTarget(state, run, targetSession, configHash);
      if (live !== null) return { kind: "live", stepRunId: step.id, live };
    }
    // Everything below starts a turn, and the run owns a single worktree, so it waits for the live one to end.
    if (hasRunActivity(state, run.id) || !canFollowUpRun(run.status)) return null;
    if (route === null) {
      return {
        kind: "unreachable",
        stepRunId: step.id,
        reason: `step ${step.id} is ${step.status} and will not run another turn`,
      };
    }
    if (targetSession?.provider_session_id) {
      return { kind: "send", stepRunId: step.id, session: targetSession };
    }
    return {
      kind: "unreachable",
      stepRunId: step.id,
      reason: `step ${step.id} has no provider session to resume`,
    };
  }
  return null;
}

/**
 * The single delivery mechanism. A step whose provider process is still running
 * takes its batch live, on that same invocation; anything else travels one step's
 * batch per resume turn, because the run owns a single worktree.
 */
export async function deliverQueuedContributions(
  state: SupervisorState,
  runId: string,
): Promise<void> {
  if (state.shuttingDown || state.aborting.has(runId) || state.delivering.has(runId)) return;
  // Failing an unreachable step must not strand a later step that can still be sent, so the scan resumes past it.
  let queued = listClaimableRunContributions(state.db, runId);
  while (queued.length > 0) {
    const run = getRun(state.db, runId);
    if (!run || state.aborting.has(runId) || state.shuttingDown) return;
    const target = nextDeliveryTarget(state, run, queued);
    if (target === null) return;
    const batch = headTargetBatch(queued.filter((row) => row.step_run_id === target.stepRunId));

    if (target.kind === "send") {
      // Only a spawn needs the run-level guard: a live batch is claimed synchronously, so a concurrent post can never pick it up.
      state.delivering.add(runId);
      try {
        await sendBatch(state, run, target.session, batch);
      } finally {
        state.delivering.delete(runId);
      }
      return;
    }
    if (target.kind === "live") {
      if (!(await deliverLiveContributions(state, runId, target.live, batch))) return;
    } else {
      failBatch(state, batch, target.reason);
    }
    queued = listClaimableRunContributions(state.db, runId);
  }
}

/** A settled run starts no further turn on its own, so its unclaimed queue is withdrawn rather than left waiting forever. */
export function cancelUndeliverableContributions(state: SupervisorState, runId: string): void {
  const run = getRun(state.db, runId);
  if (!run || !isRunSettled(run.status)) return;
  const now = new Date().toISOString();
  for (const row of listClaimableRunContributions(state.db, runId)) {
    assertContributionTransitions([row], "canceled");
    writeRunContributionCanceled(state.db, row.id, now);
    emitContributionEvent(state, requireRunContribution(state, row.id));
  }
}
