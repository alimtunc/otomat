import { getRun, listAgentSessionsForRun, type AgentSessionRow, type RunRow } from "@otomat/db";
import type { StartRunRequest } from "@otomat/domain";

import { spawnTurn } from "./lifecycle.js";
import { prepareRun } from "./prepare.js";
import { runDir } from "./run-events.js";
import type { SupervisorState } from "./state.js";

/** A resume the caller got wrong (bad state, concurrent turn, no session) — a conflict, not a daemon fault. */
export class RunNotResumableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotResumableError";
  }
}

export async function startRun(state: SupervisorState, request: StartRunRequest): Promise<RunRow> {
  const ctx = prepareRun(state.db, state.dataDir, state.defaultProjectId, request);
  await spawnTurn(state, ctx, "run", null);
  const row = getRun(state.db, ctx.runId);
  if (!row) throw new Error("run vanished immediately after spawn");
  return row;
}

export async function resumeRun(state: SupervisorState, runId: string): Promise<RunRow> {
  const { db } = state;
  const run = getRun(db, runId);
  if (!run) throw new RunNotResumableError(`run ${runId} not found`);
  if (run.status !== "awaiting_human") {
    throw new RunNotResumableError(`run ${runId} is not resumable (status ${run.status})`);
  }
  if (state.claiming.has(runId) || state.inflight.has(runId)) {
    throw new RunNotResumableError(`run ${runId} is already running`);
  }

  const session = pickResumableSession(listAgentSessionsForRun(db, runId));
  if (!session) throw new RunNotResumableError(`run ${runId} has no provider session to resume`);

  const prompt = run.plan_json.steps[0]?.prompt ?? null;
  if (prompt === null) throw new Error(`run ${runId} has no plan step to resume`);

  await spawnTurn(
    state,
    {
      runId,
      stepRunId: session.step_run_id,
      agentSessionId: session.id,
      prompt,
      runDir: runDir(state.dataDir, runId),
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
