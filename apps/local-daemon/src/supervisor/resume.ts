import {
  getIssue,
  getRun,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type Db,
  type RunRow,
} from "@otomat/db";
import { executableSteps, selectLatestResumableSession, type RunState } from "@otomat/domain";

import { sessionDir } from "#events";
import { createRuntimeAdapter, isKnownRuntimeId, type KnownRuntimeId } from "#runtime";

import { spawnTurn } from "./lifecycle.js";
import { runtimeForRun } from "./runtime-selection.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveIssueTo } from "./transitions.js";
import type { TurnContext } from "./types.js";

/** A resume the caller got wrong (bad state, concurrent turn, no session) — a conflict, not a daemon fault. */
export class RunNotResumableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotResumableError";
  }
}

/** The exact turn a resume would spawn: same provider session, same worktree, a new prompt. */
export interface ResumeTurn {
  context: TurnContext;
  providerSessionId: string | null;
}

/** The known runtime a resume must reuse; an unknown one or one without `resume` is a caller conflict. */
export function requireResumableRuntime(
  db: Db,
  run: RunRow,
  session: AgentSessionRow,
): KnownRuntimeId {
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

export function requireRunRow(db: Db, runId: string, when: "spawn" | "resume" | "append"): RunRow {
  const row = getRun(db, runId);
  if (!row) throw new Error(`run vanished immediately after ${when}`);
  return row;
}

export function requireResumableRun(
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
  reopenIssue(state.db, run);
  return run;
}

/** Runs before any worktree work so a closed issue refuses the resume rather than reopening. */
function reopenIssue(db: Db, run: RunRow): void {
  const issue = getIssue(db, run.issue_id);
  if (issue) driveIssueTo(db, issue.id, issue.status, "running");
}

/** Resolves the run's latest resumable session into a spawnable turn without touching any row. */
export function resolveResumeTurn(state: SupervisorState, run: RunRow, prompt: string): ResumeTurn {
  const { db } = state;
  const runId = run.id;
  const session = selectLatestResumableSession(
    listAgentSessionsForRun(db, runId),
    listStepRunsForRun(db, runId),
    listCompeteGroupsForRun(db, runId),
  );
  if (!session) throw new RunNotResumableError(`run ${runId} has no provider session to resume`);

  const runtime = requireResumableRuntime(db, run, session);
  const worktreePath = state.repositories
    .forRepository(run.repository_id)
    ?.service.get(runId)?.path;
  if (worktreePath === undefined) {
    throw new RunNotResumableError(`run ${runId} worktree is unavailable`);
  }
  const config =
    executableSteps(run.plan_json).find((step) => step.id === session.step_run_id)?.config ?? null;

  return {
    context: {
      runId,
      stepRunId: session.step_run_id,
      agentSessionId: session.id,
      prompt,
      agentSessionDir: sessionDir(state.dataDir, runId, session.id),
      worktreePath,
      runtime,
      config,
    },
    providerSessionId: session.provider_session_id,
  };
}

/** Spawns the resolved resume turn; the run row is re-read once the worker is live. */
export async function spawnResumeTurn(
  state: SupervisorState,
  run: RunRow,
  prompt: string,
): Promise<RunRow> {
  const turn = resolveResumeTurn(state, run, prompt);
  await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  return requireRunRow(state.db, run.id, "resume");
}
