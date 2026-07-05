import { getRun, listAgentSessionsForRun, type AgentSessionRow, type RunRow } from "@otomat/db";
import type { RunState, StartRunRequest } from "@otomat/domain";

import { runDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { prepareRun } from "./prepare.js";
import type { SupervisorState } from "./state.js";

/** A resume the caller got wrong (bad state, concurrent turn, no session) — a conflict, not a daemon fault. */
export class RunNotResumableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotResumableError";
  }
}

export async function startRun(state: SupervisorState, request: StartRunRequest): Promise<RunRow> {
  const ctx = prepareRun(state, request);
  await spawnTurn(state, ctx, "run", null);
  const row = getRun(state.db, ctx.runId);
  if (!row) throw new Error("run vanished immediately after spawn");
  return row;
}

/** Resumes a run waiting on a human by spawning a `resume` turn against its existing provider session. Throws `RunNotResumableError` unless the run is in `awaiting_human`, is not already running, and has a resumable provider session. */
export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  const run = requireFollowUpableRun(state, runId, "awaiting_human");
  const prompt = run.plan_json.steps[0]?.prompt ?? null;
  if (prompt === null) throw new Error(`run ${runId} has no plan step to resume`);
  return spawnFollowUpTurn(state, runId, prompt);
}

/** A fix turn is an honest resume: same provider session, a new prompt built from the review comments. */
export async function fixRun(
  state: SupervisorState,
  runId: string,
  prompt: string,
): Promise<RunRow> {
  requireFollowUpableRun(state, runId, "review_ready");
  return spawnFollowUpTurn(state, runId, prompt);
}

function requireFollowUpableRun(
  state: SupervisorState,
  runId: string,
  requiredStatus: RunState,
): RunRow {
  const run = getRun(state.db, runId);
  if (!run) throw new RunNotResumableError(`run ${runId} not found`);
  if (run.status !== requiredStatus) {
    throw new RunNotResumableError(`run ${runId} is not resumable (status ${run.status})`);
  }
  if (state.claiming.has(runId) || state.inflight.has(runId)) {
    throw new RunNotResumableError(`run ${runId} is already running`);
  }
  return run;
}

async function spawnFollowUpTurn(
  state: SupervisorState,
  runId: string,
  prompt: string,
): Promise<RunRow> {
  const { db } = state;
  const session = pickResumableSession(listAgentSessionsForRun(db, runId));
  if (!session) throw new RunNotResumableError(`run ${runId} has no provider session to resume`);

  await spawnTurn(
    state,
    {
      runId,
      stepRunId: session.step_run_id,
      agentSessionId: session.id,
      prompt,
      runDir: runDir(state.dataDir, runId),
      worktreePath: state.worktrees?.service.get(runId)?.path ?? null,
    },
    "resume",
    session.provider_session_id,
  );

  const row = getRun(db, runId);
  if (!row) throw new Error("run vanished immediately after resume");
  return row;
}

function pickResumableSession(sessions: AgentSessionRow[]): AgentSessionRow | undefined {
  return sessions.find((session) => session.provider_session_id !== null);
}
