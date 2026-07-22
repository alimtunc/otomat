import {
  getRun,
  listCompeteGroupsForRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type CompeteGroupRow,
  type Db,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import {
  executableSteps,
  isRunPlanCompeteGroup,
  RUN_FOLLOW_UP_STATES,
  selectLatestResumableSession,
  type RunState,
  type StartRunRequest,
} from "@otomat/domain";

import { sessionDir } from "#events";
import { createRuntimeAdapter, isKnownRuntimeId, type KnownRuntimeId } from "#runtime";

import { scheduleTurn, startNextReadyStep } from "./advance.js";
import { spawnTurn } from "./lifecycle.js";
import { prepareRun } from "./prepare.js";
import { runtimeForRun } from "./runtime-selection.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveCompeteGroupTo } from "./transitions.js";
import type { TurnContext } from "./types.js";

/** A resume the caller got wrong (bad state, concurrent turn, no session) — a conflict, not a daemon fault. */
export class RunNotResumableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotResumableError";
  }
}

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
  const run = requireFollowUpableRun(state, runId, ["awaiting_human"]);
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
    return spawnFollowUpTurn(state, run, prompt);
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
  return spawnFollowUpTurn(state, run, lastPrompt);
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
  const run = requireFollowUpableRun(state, runId, ["review_ready"]);
  return spawnFollowUpTurn(state, run, prompt);
}

/** A user follow-up is an honest resume from any resting state: same provider session, same worktree, same run — the user's own prompt as the new turn. */
export async function followUpRun(
  state: SupervisorState,
  runId: string,
  prompt: string,
): Promise<RunRow> {
  const run = requireFollowUpableRun(state, runId, RUN_FOLLOW_UP_STATES);
  return spawnFollowUpTurn(state, run, prompt);
}

/** The known runtime a resume must reuse; an unknown one or one without `resume` is a caller conflict. */
function requireResumableRuntime(db: Db, run: RunRow, session: AgentSessionRow): KnownRuntimeId {
  const runtime = session.agent_id ?? runtimeForRun(db, run);
  if (
    runtime === undefined ||
    !isKnownRuntimeId(runtime) ||
    !createRuntimeAdapter(runtime).capabilities.resume
  ) {
    throw new RunNotResumableError(`run ${run.id} runtime "${runtime}" does not support resume`);
  }
  return runtime;
}

function requireRunRow(db: Db, runId: string, when: "spawn" | "resume"): RunRow {
  const row = getRun(db, runId);
  if (!row) throw new Error(`run vanished immediately after ${when}`);
  return row;
}

function requireFollowUpableRun(
  state: SupervisorState,
  runId: string,
  allowedStatuses: readonly RunState[],
): RunRow {
  const run = getRun(state.db, runId);
  if (!run) throw new RunNotResumableError(`run ${runId} not found`);
  if (!allowedStatuses.includes(run.status)) {
    throw new RunNotResumableError(`run ${runId} is not resumable (status ${run.status})`);
  }
  if (hasRunActivity(state, runId)) {
    throw new RunNotResumableError(`run ${runId} is already running`);
  }
  return run;
}

async function spawnFollowUpTurn(
  state: SupervisorState,
  run: RunRow,
  prompt: string,
): Promise<RunRow> {
  const { db } = state;
  const runId = run.id;
  const steps = listStepRunsForRun(db, runId);
  const session = selectLatestResumableSession(
    listAgentSessionsForRun(db, runId),
    steps,
    listCompeteGroupsForRun(db, runId),
  );
  if (!session) throw new RunNotResumableError(`run ${runId} has no provider session to resume`);

  const runtime = requireResumableRuntime(db, run, session);
  const worktreePath =
    state.repositories.forRepository(run.repository_id)?.service.get(runId)?.path ?? null;
  if (worktreePath === null && run.plan_json.steps.some(isRunPlanCompeteGroup)) {
    throw new RunNotResumableError(`run ${runId} canonical compete worktree is unavailable`);
  }
  // Resume uses the config frozen for this session's step — never the live profile.
  const config =
    executableSteps(run.plan_json).find((step) => step.id === session.step_run_id)?.config ?? null;

  await spawnTurn(
    state,
    {
      runId,
      stepRunId: session.step_run_id,
      agentSessionId: session.id,
      prompt,
      agentSessionDir: sessionDir(state.dataDir, runId, session.id),
      worktreePath,
      runtime,
      config,
    },
    "resume",
    session.provider_session_id,
  );

  return requireRunRow(db, runId, "resume");
}
