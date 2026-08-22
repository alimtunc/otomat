import { randomUUID } from "node:crypto";

import {
  getIssue,
  getRun,
  getStepRun,
  insertAgentSession,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type AgentSessionRow,
  type Db,
  type IssueRow,
  type RunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  executableSteps,
  IllegalTransitionError,
  isIssueClosed,
  isRunSettled,
  selectLatestResumableSession,
  type ResolvedAgentConfig,
} from "@otomat/domain";

import { sessionDir } from "#events";
import {
  createRuntimeAdapter,
  describeRuntimeResumeModelCapability,
  isKnownRuntimeId,
  type KnownRuntimeId,
} from "#runtime";

import { spawnTurn } from "./lifecycle.js";
import { runtimeForRun } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import { driveIssueTo, driveRunTo, driveStepTo } from "./transitions.js";
import type { TurnContext } from "./types.js";

/** A reattached session still holds its own conversation and dossier, so it is told to continue rather than handed the context again. */
export const NATIVE_CONTINUATION = [
  "Your previous turn stopped before finishing. You still have this session's",
  "context and the same worktree. Check what you had already changed, then continue",
  "from where you stopped.",
].join("\n");

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

/** Runs before any worktree work so a closed issue refuses the resume: only an operator reopens one. */
export function reopenIssue(db: Db, run: RunRow): IssueRow | undefined {
  const issue = getIssue(db, run.issue_id);
  if (!issue) return undefined;
  if (isIssueClosed(issue.status)) {
    throw new IllegalTransitionError("issue", issue.status, "running");
  }
  driveIssueTo(db, issue.id, issue.status, "running");
  return issue;
}

/** Re-enters through `preparing`, so a reopened row stops advertising a completion time it no longer has. */
export function reopenSettledRun(state: SupervisorState, run: RunRow): RunRow {
  if (!isRunSettled(run.status)) return run;
  driveRunTo(state.db, run.id, run.status, "preparing", new Date().toISOString());
  return requireRunRow(state.db, run.id, "resume");
}

/**
 * Stopping a run cancels every step it had not finished, so the reopened step
 * would be the last one the plan could ever run. An explicit resume owes those
 * steps back to the plan: they queue again and the run chains through them once
 * the recovered step succeeds.
 */
export function requeueCanceledSteps(db: Db, runId: string, reopenedStepId: string): void {
  db.transaction(
    () => {
      for (const step of listStepRunsForRun(db, runId)) {
        if (step.id === reopenedStepId || step.compete_group_id !== null) continue;
        if (step.status === "canceled") driveStepTo(db, step.id, step.status, "queued");
      }
    },
    { behavior: "immediate" },
  );
}

function resumeTurnFor(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  turn: Pick<TurnContext, "agentSessionId" | "prompt" | "config" | "carryContributionIds">,
): ResumeTurn {
  const runtime = requireResumableRuntime(state.db, run, session);
  const worktreePath = requireWorktreePath(state, run);
  const step = executableSteps(run.plan_json).find((entry) => entry.id === session.step_run_id);

  return {
    context: {
      ...turn,
      runId: run.id,
      stepRunId: session.step_run_id,
      contextSelection: step?.context ?? null,
      agentSessionDir: sessionDir(state.dataDir, run.id, turn.agentSessionId),
      worktreePath,
      runtime,
      config: turn.config ?? step?.config ?? null,
    },
    providerSessionId: session.provider_session_id,
  };
}

/** Resolves one explicit session into a spawnable turn without touching any row. */
export function resolveSessionResumeTurn(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  prompt: string | null,
): ResumeTurn {
  return resumeTurnFor(state, run, session, {
    agentSessionId: session.id,
    prompt,
    config: session.config_json,
  });
}

/** Opens the next turn of one participant as its own session row, so the queue it carries is auditable. The context is resolved before the row lands, so a refused resume leaves no orphan session behind. */
export function insertSessionResumeTurn(
  state: SupervisorState,
  run: RunRow,
  session: AgentSessionRow,
  config: ResolvedAgentConfig,
  prompt: string | null,
  contributionIds: readonly string[],
): ResumeTurn {
  const agentSessionId = randomUUID();
  const turn = resumeTurnFor(state, run, session, {
    agentSessionId,
    prompt,
    config,
    carryContributionIds: contributionIds,
  });
  insertAgentSession(state.db, {
    id: agentSessionId,
    step_run_id: session.step_run_id,
    agent_id: session.agent_id,
    status: agentSessionMachine.initial,
    provider_session_id: session.provider_session_id,
    resumed_from_session_id: session.id,
    config_json: config,
  });
  return turn;
}

/** A pending model revision resumes only through a runtime that announces resume-with-model; refusing beats silently running the old model. */
export function requireResumeConfigSupport(
  db: Db,
  run: RunRow,
  session: AgentSessionRow,
  config: ResolvedAgentConfig,
): void {
  if (session.config_json?.config_hash === config.config_hash) return;
  const capability = describeRuntimeResumeModelCapability(
    requireResumableRuntime(db, run, session),
  );
  if (capability.status !== "supported") throw new RunNotResumableError(capability.reason);
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
  // A revision back to the session's own configuration is nothing to consume; `spawnTurn` clears it.
  const revised = getStepRun(db, session.step_run_id)?.next_turn_config_json ?? null;
  const pending =
    revised === null || revised.config_hash === session.config_json?.config_hash ? null : revised;
  let turn: ResumeTurn;
  if (pending === null) {
    turn = resolveSessionResumeTurn(state, run, session, prompt);
  } else {
    requireResumeConfigSupport(db, run, session, pending);
    turn = insertSessionResumeTurn(state, run, session, pending, prompt, []);
  }
  await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
  return requireRunRow(state.db, run.id, "resume");
}
