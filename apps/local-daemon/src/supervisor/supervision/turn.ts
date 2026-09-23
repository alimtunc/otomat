import { randomUUID } from "node:crypto";

import {
  insertAgentSession,
  listAgentSessionsForRun,
  listPendingRunInteractionsForSession,
  type AgentSessionRow,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  stepPassBounds,
  stepSessions,
  supervisionDecisionsFor,
  type Supervision,
} from "@otomat/domain";

import { readRunEvents, sessionDir } from "#events";
import type { CanonicalDiff } from "#git";

import { runStillLive } from "../init-commands.js";
import { spawnTurn } from "../lifecycle.js";
import { requireWorktreePath } from "../resume.js";
import { preflightRuntimeConfig } from "../runtime-preflight.js";
import { ensureRuntimeAgent } from "../runtime-selection.js";
import type { SupervisorState } from "../state.js";
import type { TurnContext } from "../types.js";
import { buildSupervisionPrompt, type SupervisionBrief } from "./prompt.js";

/** Read from the repository, not the worktree: the pass may already have been superseded by the next one. */
async function stepDiff(
  state: SupervisorState,
  run: RunRow,
  sessions: readonly AgentSessionRow[],
): Promise<CanonicalDiff | null> {
  const bounds = stepPassBounds(sessions);
  if (bounds === null) return null;
  const service = state.repositories.forRepository(run.repository_id)?.service ?? null;
  if (service === null) return null;
  return (await service.boundaryDiff(bounds.start_tree_sha, bounds.end_tree_sha))?.diff ?? null;
}

async function buildBrief(
  state: SupervisorState,
  run: RunRow,
  step: StepRunRow,
): Promise<SupervisionBrief> {
  const events = readRunEvents(state.db, run.id);
  const sessions = stepSessions(listAgentSessionsForRun(state.db, run.id), step.id);
  const sessionIds = new Set(sessions.map((session) => session.id));
  return {
    step,
    diff: await stepDiff(state, run, sessions),
    events: events.filter(
      (event) => event.agent_session_id !== null && sessionIds.has(event.agent_session_id),
    ),
    history: supervisionDecisionsFor(events, step.id),
    pendingQuestions: sessions.reduce(
      (count, session) => count + listPendingRunInteractionsForSession(state.db, session.id).length,
      0,
    ),
  };
}

/** Wakes the frozen supervisor on one settled step and lets it exit: the ledger, not a live process, carries its verdict. */
export async function spawnSupervisionTurn(
  state: SupervisorState,
  run: RunRow,
  step: StepRunRow,
  supervision: Supervision,
): Promise<void> {
  const worktreePath = requireWorktreePath(state, run);
  const runtime = ensureRuntimeAgent(state.db, supervision.config.runtime);
  preflightRuntimeConfig(runtime, supervision.config, worktreePath);
  const prompt = buildSupervisionPrompt(await buildBrief(state, run, step));
  // An abort or shutdown during the brief owns the run; its pending verdict stays for the next pass.
  if (!runStillLive(state, run.id)) return;
  const agentSessionId = randomUUID();
  insertAgentSession(state.db, {
    id: agentSessionId,
    step_run_id: step.id,
    kind: "supervision",
    agent_id: runtime,
    status: agentSessionMachine.initial,
    config_json: supervision.config,
  });
  const ctx: TurnContext = {
    runId: run.id,
    stepRunId: step.id,
    agentSessionId,
    kind: "supervision",
    prompt,
    contextSelection: null,
    agentSessionDir: sessionDir(state.dataDir, run.id, agentSessionId),
    worktreePath,
    runtime,
    config: supervision.config,
  };
  await spawnTurn(state, ctx, "run", null);
}
