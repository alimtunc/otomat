import { getRun, listAgentSessionsForRun, listStepRunsForRun, type RunRow } from "@otomat/db";
import { isRunSettled, type StartRunRequest } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { scheduleNextStep, startNextReadyStep } from "./advance.js";
import { failIdleRun, failureReason } from "./fail-run.js";
import { repositoryInitCommands } from "./init-commands.js";
import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { requireLaunchable } from "./launch-hold.js";
import { buildRunReopenedEvent } from "./markers.js";
import { prepareRun } from "./prepare.js";
import { resolveResumeAction, type ResumeAction } from "./resume-plan.js";
import { resumeCompeteGroup, spawnReopenTurn } from "./resume-turn.js";
import {
  reopenIssue,
  reopenSettledRun,
  requeueCanceledSteps,
  requireRunRow,
  RunNotResumableError,
} from "./resume.js";
import { preflightResumeAction } from "./runtime-preflight.js";
import type { SupervisorState } from "./state.js";
import { scheduleWorktreeInit } from "./worktree-init.js";

/**
 * Omitting `issue_id` creates a local issue from the prompt. Every precondition is
 * checked before any row is written, so a refusal still throws here; past that point
 * the launch answers and worktree init and the first step continue in the background.
 */
export async function startRun(state: SupervisorState, request: StartRunRequest): Promise<RunRow> {
  requireLaunchable(state);
  const runId = prepareRun(state, request);
  const run = requireRunRow(state.db, runId, "spawn");
  signalIssueLifecycle(state.syncIssueLifecycle, run.issue_id, "in_progress", runId);
  const initCommands = repositoryInitCommands(state.db, run.repository_id);
  if (initCommands.length > 0) scheduleWorktreeInit(state, run, initCommands);
  else scheduleNextStep(state, run);
  return requireRunRow(state.db, runId, "spawn");
}

/** A run paused between steps owes the plan its next node; a worktree that never ran anything is initialized first. */
async function startNextPlanNode(state: SupervisorState, run: RunRow): Promise<RunRow> {
  if (listAgentSessionsForRun(state.db, run.id).length === 0) {
    const initCommands = repositoryInitCommands(state.db, run.repository_id);
    if (initCommands.length > 0) {
      scheduleWorktreeInit(state, run, initCommands);
      return requireRunRow(state.db, run.id, "resume");
    }
  }
  if (!(await startNextReadyStep(state, run))) {
    throw new RunNotResumableError(`run ${run.id} has no step left to start`);
  }
  return requireRunRow(state.db, run.id, "resume");
}

function recoverStoppedRun(
  state: SupervisorState,
  stopped: RunRow,
  action: Extract<ResumeAction, { kind: "native" | "recovery" }>,
): void {
  if (!isRunSettled(stopped.status)) return;
  requeueCanceledSteps(state.db, stopped.id, action.step.id);
  emitLedgerEvent(
    state.db,
    state.dataDir,
    stopped.id,
    buildRunReopenedEvent(
      { runId: stopped.id, stepRunId: action.step.id, agentSessionId: null },
      stopped.status,
      action.step.name,
      new Date().toISOString(),
    ),
  );
}

/** Resumes a run on an explicit user action, never on its own; `resolveResumeAction` is the single decision, so what the cockpit announced is what runs. */
export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  requireLaunchable(state);
  const stopped = getRun(state.db, runId);
  if (!stopped) throw new RunNotResumableError(`run ${runId} not found`);
  const action = resolveResumeAction(state, stopped);
  if (action.kind === "unavailable") {
    throw new RunNotResumableError(`run ${runId} cannot be resumed: ${action.reason}`);
  }

  preflightResumeAction(state, stopped, action);

  reopenIssue(state.db, stopped);
  if (action.kind === "native" || action.kind === "recovery") {
    recoverStoppedRun(state, stopped, action);
  }
  const run = reopenSettledRun(state, stopped);
  signalIssueLifecycle(state.syncIssueLifecycle, run.issue_id, "in_progress", runId);
  for (const step of listStepRunsForRun(state.db, runId)) state.stopHeld.delete(step.id);

  try {
    if (action.kind === "compete_group") {
      const steps = listStepRunsForRun(state.db, runId);
      return await resumeCompeteGroup(state, run, action, steps);
    }
    if (action.kind === "next_step") return await startNextPlanNode(state, run);
    return await spawnReopenTurn(state, run, action);
  } catch (error) {
    // A reopened run that never reached a worker must not be left resting in `preparing`.
    if (run.status !== stopped.status) {
      failIdleRun(state, runId, `resume failed: ${failureReason(error)}`);
    }
    throw error;
  }
}
