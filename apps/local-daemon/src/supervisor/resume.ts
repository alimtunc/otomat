import {
  getIssue,
  getRun,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type Db,
  type IssueRow,
  type RunRow,
} from "@otomat/db";
import { executableSteps, isRunSettled, selectLatestResumableSession } from "@otomat/domain";

import { sessionDir } from "#events";
import { createRuntimeAdapter, isKnownRuntimeId, type KnownRuntimeId } from "#runtime";

import { spawnTurn } from "./lifecycle.js";
import { runtimeForRun } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import { driveIssueTo, driveRunTo } from "./transitions.js";
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

/** The known runtime whose adapter can reattach this session, or null when none can. */
export function resumableRuntime(
  db: Db,
  run: RunRow,
  session: AgentSessionRow,
): KnownRuntimeId | null {
  const runtime = session.agent_id ?? runtimeForRun(db, run);
  if (runtime === undefined || !isKnownRuntimeId(runtime)) return null;
  return createRuntimeAdapter(runtime).capabilities.resume ? runtime : null;
}

/** The known runtime a resume must reuse; an unknown one or one without `resume` is a caller conflict. */
export function requireResumableRuntime(
  db: Db,
  run: RunRow,
  session: AgentSessionRow,
): KnownRuntimeId {
  const runtime = resumableRuntime(db, run, session);
  if (runtime !== null) return runtime;
  const raw = session.agent_id ?? runtimeForRun(db, run);
  throw new RunNotResumableError(`run ${run.id} runtime "${raw}" does not support resume`);
}

/** The worktree a resume walks back into; a missing one is a caller conflict, not a daemon fault. */
export function requireWorktreePath(state: SupervisorState, run: RunRow): string {
  const path = state.repositories.forRepository(run.repository_id)?.service.get(run.id)?.path;
  if (path === undefined) throw new RunNotResumableError(`run ${run.id} worktree is unavailable`);
  return path;
}

type RunReadPoint = "spawn" | "resume" | "append" | "abandon";

export function requireRunRow(db: Db, runId: string, when: RunReadPoint): RunRow {
  const row = getRun(db, runId);
  if (!row) throw new Error(`run vanished immediately after ${when}`);
  return row;
}

/** Runs before any worktree work so a closed issue refuses the resume rather than reopening. */
export function reopenIssue(db: Db, run: RunRow): IssueRow | undefined {
  const issue = getIssue(db, run.issue_id);
  if (issue) driveIssueTo(db, issue.id, issue.status, "running");
  return issue;
}

/** Re-enters through `preparing`, so a reopened row stops advertising a completion time it no longer has. */
export function reopenSettledRun(state: SupervisorState, run: RunRow): RunRow {
  if (!isRunSettled(run.status)) return run;
  driveRunTo(state.db, run.id, run.status, "preparing", new Date().toISOString());
  return requireRunRow(state.db, run.id, "resume");
}

/** Resolves one explicit session into a spawnable turn without touching any row. */
export function resolveSessionResumeTurn(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  prompt: string | null,
): ResumeTurn {
  const { db } = state;
  const runId = run.id;
  const runtime = requireResumableRuntime(db, run, session);
  const worktreePath = requireWorktreePath(state, run);
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

/** Spawns a resume turn on the run's latest resumable session; the run row is re-read once the worker is live. */
export async function spawnResumeTurn(
  state: SupervisorState,
  run: RunRow,
  prompt: string,
): Promise<RunRow> {
  const { db } = state;
  const session = selectLatestResumableSession(
    listAgentSessionsForRun(db, run.id),
    listStepRunsForRun(db, run.id),
    listCompeteGroupsForRun(db, run.id),
  );
  if (!session) throw new RunNotResumableError(`run ${run.id} has no provider session to resume`);
  const turn = resolveSessionResumeTurn(state, run, session, prompt);
  await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  return requireRunRow(state.db, run.id, "resume");
}
