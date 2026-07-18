import {
  getRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { RUN_FOLLOW_UP_STATES, type RunState, type StartRunRequest } from "@otomat/domain";

import { runDir } from "#events";
import { createRuntimeAdapter, isKnownRuntimeId } from "#runtime";

import { startNextReadyStep } from "./advance.js";
import { spawnTurn } from "./lifecycle.js";
import { prepareRun } from "./prepare.js";
import { runtimeForRun } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";

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
  const ctx = prepareRun(state, request);
  await spawnTurn(state, ctx, "run", null);
  const row = getRun(state.db, ctx.runId);
  if (!row) throw new Error("run vanished immediately after spawn");
  return row;
}

/**
 * Resumes a run waiting on a human. An interrupted step resumes its own provider
 * session; a run paused between steps starts the next ready plan step fresh; a
 * run whose steps all finished (a torn follow-up turn) resumes its latest
 * session. Throws `RunNotResumableError` unless the run is in `awaiting_human`,
 * is not already running, and has a step to resume or start.
 */
export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  const run = requireFollowUpableRun(state, runId, ["awaiting_human"]);
  const steps = listStepRunsForRun(state.db, runId);
  const interrupted = steps.find((step) => step.status === "awaiting_human");

  if (interrupted) {
    const prompt = run.plan_json.steps.find((step) => step.id === interrupted.id)?.prompt ?? null;
    if (prompt === null) throw new Error(`run ${runId} has no plan step to resume`);
    return spawnFollowUpTurn(state, run, prompt);
  }

  const started = await startNextReadyStep(state, run);
  if (started) {
    const row = getRun(state.db, runId);
    if (!row) throw new Error("run vanished immediately after resume");
    return row;
  }

  const lastPrompt = run.plan_json.steps.at(-1)?.prompt ?? null;
  if (lastPrompt === null) throw new RunNotResumableError(`run ${runId} has no step to resume`);
  return spawnFollowUpTurn(state, run, lastPrompt);
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
  if (state.claiming.has(runId) || state.inflight.has(runId)) {
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
  const session = pickResumableSession(listAgentSessionsForRun(db, runId), steps);
  if (!session) throw new RunNotResumableError(`run ${runId} has no provider session to resume`);

  const runtime = session.agent_id ?? runtimeForRun(db, run);
  if (
    runtime === undefined ||
    !isKnownRuntimeId(runtime) ||
    !createRuntimeAdapter(runtime).capabilities.resume
  ) {
    throw new RunNotResumableError(`run ${runId} runtime "${runtime}" does not support resume`);
  }

  await spawnTurn(
    state,
    {
      runId,
      stepRunId: session.step_run_id,
      agentSessionId: session.id,
      prompt,
      runDir: runDir(state.dataDir, runId),
      worktreePath: state.worktrees?.service.get(runId)?.path ?? null,
      runtime,
    },
    "resume",
    session.provider_session_id,
  );

  const row = getRun(db, runId);
  if (!row) throw new Error("run vanished immediately after resume");
  return row;
}

/** The latest resumable session: the one on the furthest plan step (an interrupted step, or the last finished turn). */
function pickResumableSession(
  sessions: readonly AgentSessionRow[],
  steps: readonly StepRunRow[],
): AgentSessionRow | undefined {
  const idxByStepId = new Map(steps.map((step) => [step.id, step.idx]));
  let best: AgentSessionRow | undefined;
  let bestIdx = -1;
  for (const session of sessions) {
    if (session.provider_session_id === null) continue;
    const idx = idxByStepId.get(session.step_run_id) ?? -1;
    if (idx >= bestIdx) {
      best = session;
      bestIdx = idx;
    }
  }
  return best;
}
