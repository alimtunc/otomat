import {
  listCompeteGroupsForRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  type CompeteGroupRow,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { executableSteps, isRunPlanCompeteGroup, type StartRunRequest } from "@otomat/domain";

import { sessionDir } from "#events";

import { scheduleTurn, startNextReadyStep } from "./advance.js";
import { prepareRun } from "./prepare.js";
import {
  requireResumableRun,
  requireResumableRuntime,
  requireRunRow,
  RunNotResumableError,
  spawnResumeTurn,
} from "./resume.js";
import type { SupervisorState } from "./state.js";
import { driveCompeteGroupTo } from "./transitions.js";
import type { TurnContext } from "./types.js";

/**
 * Starts a fresh run. Side effect: when the request omits `issue_id`, a local `issue`
 * row is created from the prompt (its first line as the title) to anchor the run.
 */
export async function startRun(state: SupervisorState, request: StartRunRequest): Promise<RunRow> {
  const runId = prepareRun(state, request);
  const run = requireRunRow(state.db, runId, "spawn");
  await startNextReadyStep(state, run);
  return requireRunRow(state.db, runId, "spawn");
}

/** Resumes an `awaiting_human` run: an interrupted step resumes its own session, a run paused between steps starts the next ready step, a torn follow-up turn resumes the latest session. */
export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  const run = requireResumableRun(state, runId, ["awaiting_human"]);
  const steps = listStepRunsForRun(state.db, runId);
  const interruptedGroup = listCompeteGroupsForRun(state.db, runId).find(
    (group) => group.status === "awaiting_human",
  );
  if (interruptedGroup) {
    return resumeCompeteGroup(state, run, interruptedGroup, steps);
  }
  const interrupted = steps.find((step) => step.status === "awaiting_human");

  if (interrupted) {
    const prompt =
      executableSteps(run.plan_json).find((step) => step.id === interrupted.id)?.prompt ?? null;
    if (prompt === null) throw new Error(`run ${runId} has no plan step to resume`);
    return spawnResumeTurn(state, run, prompt);
  }

  const started = await startNextReadyStep(state, run);
  if (started) return requireRunRow(state.db, runId, "resume");

  const lastNode = run.plan_json.steps.at(-1);
  let lastPrompt: string | null = null;
  if (lastNode) {
    lastPrompt = isRunPlanCompeteGroup(lastNode)
      ? (lastNode.compete.at(-1)?.prompt ?? null)
      : lastNode.prompt;
  }
  if (lastPrompt === null) throw new RunNotResumableError(`run ${runId} has no step to resume`);
  return spawnResumeTurn(state, run, lastPrompt);
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
      if (!session || session.provider_session_id === null || !planStep?.prompt) {
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
          prompt: planStep.prompt,
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

/** A fix turn is an honest resume: same provider session, a new prompt built from the review comments. */
export async function fixRun(
  state: SupervisorState,
  runId: string,
  prompt: string,
): Promise<RunRow> {
  const run = requireResumableRun(state, runId, ["review_ready"]);
  return spawnResumeTurn(state, run, prompt);
}
