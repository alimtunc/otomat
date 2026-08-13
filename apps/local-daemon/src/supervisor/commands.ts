import {
  getRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  type CompeteGroupRow,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { executableSteps, type StartRunRequest } from "@otomat/domain";

import { sessionDir } from "#events";

import { scheduleNextStep, startNextReadyStep } from "./advance.js";
import { failIdleRun, failureReason } from "./fail-run.js";
import { repositoryInitCommands } from "./init-commands.js";
import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { prepareRun } from "./prepare.js";
import { resolveResumeAction } from "./resume-plan.js";
import { spawnReopenTurn } from "./resume-turn.js";
import {
  NATIVE_CONTINUATION,
  reopenIssue,
  reopenSettledRun,
  requireResumableRuntime,
  requireRunRow,
  RunNotResumableError,
} from "./resume.js";
import type { SupervisorState } from "./state.js";
import { driveCompeteGroupTo } from "./transitions.js";
import { scheduleTurn } from "./turn-scheduling.js";
import type { TurnContext } from "./types.js";
import { scheduleWorktreeInit } from "./worktree-init.js";

/**
 * Omitting `issue_id` creates a local issue from the prompt. Every precondition is
 * checked before any row is written, so a refusal still throws here; past that point
 * the launch answers and worktree init and the first step continue in the background.
 */
export async function startRun(state: SupervisorState, request: StartRunRequest): Promise<RunRow> {
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

/** Resumes a run on an explicit user action, never on its own; `resolveResumeAction` is the single decision, so what the cockpit announced is what runs. */
export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  const stopped = getRun(state.db, runId);
  if (!stopped) throw new RunNotResumableError(`run ${runId} not found`);
  const action = resolveResumeAction(state, stopped);
  if (action.kind === "unavailable") {
    throw new RunNotResumableError(`run ${runId} cannot be resumed: ${action.reason}`);
  }

  reopenIssue(state.db, stopped);
  const run = reopenSettledRun(state, stopped);
  signalIssueLifecycle(state.syncIssueLifecycle, run.issue_id, "in_progress", runId);

  try {
    if (action.kind === "compete_group") {
      const steps = listStepRunsForRun(state.db, runId);
      return await resumeCompeteGroup(state, run, action.group, steps);
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

async function resumeCompeteGroup(
  state: SupervisorState,
  run: RunRow,
  group: CompeteGroupRow,
  steps: readonly StepRunRow[],
): Promise<RunRow> {
  const candidates = steps.filter(
    (step) => step.compete_group_id === group.id && step.status === "awaiting_human",
  );
  const sessions = listAgentSessionsForRun(state.db, run.id);
  const planSteps = executableSteps(run.plan_json);
  const service = state.repositories.forRepository(run.repository_id)?.service;
  if (!service) {
    throw new RunNotResumableError(`compete group ${group.id} repository is unavailable`);
  }
  const contexts = candidates.map(
    (candidate): { context: TurnContext; providerSessionId: string } => {
      const session = sessions.find(
        (entry) => entry.step_run_id === candidate.id && entry.provider_session_id !== null,
      );
      const planStep = planSteps.find((entry) => entry.id === candidate.id);
      if (!session || session.provider_session_id === null || !planStep) {
        throw new RunNotResumableError(`competitor ${candidate.id} has no resumable session`);
      }
      const knownRuntime = requireResumableRuntime(state.db, run, session);
      const worktreePath = service.get(candidate.id)?.path;
      if (!worktreePath) {
        throw new RunNotResumableError(`competitor ${candidate.id} worktree is unavailable`);
      }
      return {
        context: {
          runId: run.id,
          stepRunId: candidate.id,
          agentSessionId: session.id,
          prompt: planStep.prompt ?? NATIVE_CONTINUATION,
          contextSelection: planStep.context ?? null,
          agentSessionDir: sessionDir(state.dataDir, run.id, session.id),
          worktreePath,
          runtime: knownRuntime,
          config: planStep.config ?? null,
        },
        providerSessionId: session.provider_session_id,
      };
    },
  );
  if (contexts.length === 0) {
    throw new RunNotResumableError(`compete group ${group.id} has no interrupted competitor`);
  }
  driveCompeteGroupTo(state.db, group.id, group.status, "running");
  const launches = contexts.map(({ context, providerSessionId }) =>
    scheduleTurn(state, context, "resume", providerSessionId),
  );
  await launches[0];
  return requireRunRow(state.db, run.id, "resume");
}
