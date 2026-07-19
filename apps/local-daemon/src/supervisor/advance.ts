import { randomUUID } from "node:crypto";

import {
  attachStepWorktree,
  getRun,
  insertAgentSession,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  updateCompeteGroupBase,
  type RunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  isRunPlanCompeteGroup,
  readyPlanWork,
  runMachine,
  type RunPlanCompetitor,
} from "@otomat/domain";

import { emitLedgerEvent, sessionDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { buildTerminalMarker } from "./markers.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import { stepStatuses } from "./settle/index.js";
import { hasRunActivity, notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveCompeteGroupTo, driveIdleRunTo } from "./transitions.js";
import type { TurnContext } from "./types.js";

function groupStatuses(state: SupervisorState, runId: string) {
  return new Map(listCompeteGroupsForRun(state.db, runId).map((group) => [group.id, group.status]));
}

function canonicalWorktreePath(state: SupervisorState, run: RunRow): string | null {
  const path =
    state.repositories.forRepository(run.repository_id)?.service.get(run.id)?.path ?? null;
  if (path === null && run.plan_json.steps.some(isRunPlanCompeteGroup)) {
    throw new Error(`run ${run.id} compete continuation requires its canonical worktree`);
  }
  return path;
}

function insertTurn(
  state: SupervisorState,
  run: RunRow,
  step: RunPlanCompetitor,
  worktreePath: string | null,
): TurnContext {
  if (step.agent === null || step.prompt === null) {
    throw new Error(`run ${run.id} frozen plan step ${step.id} is missing its agent or prompt`);
  }
  const runtime = ensureRuntimeAgent(state.db, step.agent);
  const agentSessionId = randomUUID();
  insertAgentSession(state.db, {
    id: agentSessionId,
    step_run_id: step.id,
    agent_id: runtime,
    status: agentSessionMachine.initial,
  });
  return {
    runId: run.id,
    stepRunId: step.id,
    agentSessionId,
    prompt: step.prompt,
    runDir: sessionDir(state.dataDir, run.id, agentSessionId),
    worktreePath,
    runtime,
  };
}

export function scheduleTurn(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume" = "run",
  providerSessionId: string | null = null,
): Promise<void> {
  let pending: Promise<void>;
  pending = spawnTurn(state, ctx, mode, providerSessionId)
    .catch((error) => {
      console.error(`[otomat] run ${ctx.runId} competitor ${ctx.stepRunId} failed to start`, error);
    })
    .finally(() => state.pending.delete(pending));
  state.pending.add(pending);
  return pending;
}

async function startCompeteGroup(
  state: SupervisorState,
  run: RunRow,
  groupId: string,
  competitors: readonly RunPlanCompetitor[],
): Promise<void> {
  const group = listCompeteGroupsForRun(state.db, run.id).find((entry) => entry.id === groupId);
  if (!group) throw new Error(`run ${run.id} compete group ${groupId} is missing`);
  const sessions = listAgentSessionsForRun(state.db, run.id);
  const sessionStepIds = new Set(sessions.map((session) => session.step_run_id));
  const unstarted = competitors.filter((competitor) => !sessionStepIds.has(competitor.id));
  if (unstarted.length === 0) return;

  const binding = state.repositories.forRepository(run.repository_id);
  if (!binding) throw new Error(`run ${run.id} compete group requires a Git repository`);
  let baseHeadSha = group.base_head_sha;
  if (baseHeadSha === null) {
    baseHeadSha = binding.service.snapshot(run.id).headSha;
    updateCompeteGroupBase(state.db, group.id, baseHeadSha);
  }

  const acquiredOwners: string[] = [];
  let contexts: TurnContext[];
  try {
    contexts = unstarted.map((competitor) => {
      const worktree = binding.service.acquire({
        owner: competitor.id,
        branch: `${run.branch}--compete-${competitor.id}`,
        baseRef: run.branch,
      });
      acquiredOwners.push(competitor.id);
      attachStepWorktree(state.db, competitor.id, worktree.id);
      return insertTurn(state, run, competitor, worktree.path);
    });
  } catch (error) {
    for (const owner of acquiredOwners) {
      if (binding.service.get(owner)) binding.service.cleanup(owner);
    }
    driveCompeteGroupTo(state.db, group.id, group.status, "failed");
    throw error;
  }
  if (group.status === "queued" || group.status === "awaiting_human") {
    driveCompeteGroupTo(state.db, group.id, group.status, "running");
  }
  const launches = contexts.map((ctx) => scheduleTurn(state, ctx));
  await launches[0];
}

/** Starts the next ready plan node; a compete node schedules all candidates under the global semaphore. */
export async function startNextReadyStep(state: SupervisorState, run: RunRow): Promise<boolean> {
  const steps = listStepRunsForRun(state.db, run.id);
  const next = readyPlanWork(run.plan_json, stepStatuses(steps), groupStatuses(state, run.id));
  if (next === null) return false;
  if (next.kind === "compete") {
    await startCompeteGroup(state, run, next.group.id, next.competitors);
    return true;
  }

  const ctx = insertTurn(state, run, next.step, canonicalWorktreePath(state, run));
  await spawnTurn(state, ctx, "run", null);
  return true;
}

/** Live chain after completed work. Run-level scheduling is serialized while sibling sessions remain concurrent. */
export async function advanceRun(state: SupervisorState, runId: string): Promise<void> {
  const run = getRun(state.db, runId);
  if (!run || run.status !== "running") return;
  if (hasRunActivity(state, runId) || state.aborting.has(runId) || state.advancing.has(runId)) {
    return;
  }

  state.advancing.add(runId);
  try {
    await startNextReadyStep(state, run);
  } catch (error) {
    console.error(`[otomat] run ${runId} failed to start its next work`, error);
    const current = getRun(state.db, runId);
    if (!current || runMachine.isTerminal(current.status) || hasRunActivity(state, runId)) return;
    const now = new Date().toISOString();
    driveIdleRunTo(state.db, current, "failed", listStepRunsForRun(state.db, runId), now);
    const ref = { runId, stepRunId: null, agentSessionId: null };
    emitLedgerEvent(
      state.db,
      state.dataDir,
      runId,
      buildTerminalMarker(ref, "failed", null, 0, now),
    );
    notifyAfterSettle(state, {
      runId,
      classification: "failed",
      reason: `next work failed to start: ${error instanceof Error ? error.message : String(error)}`,
      orphanTerminated: false,
      providerSessionId: null,
    });
  } finally {
    state.advancing.delete(runId);
  }
}
