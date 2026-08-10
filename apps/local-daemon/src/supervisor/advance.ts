import {
  attachStepWorktree,
  getCompeteGroup,
  getRun,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  updateCompeteGroupBase,
  type RunRow,
} from "@otomat/db";
import { readyPlanWork, runMachine, type RunPlanCompetitor } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import type { WorktreeRecord } from "#git";

import { repositoryInitCommands } from "./init-commands.js";
import { spawnTurn } from "./lifecycle.js";
import { buildTerminalMarker } from "./markers.js";
import { competeGroupStatuses, stepStatuses } from "./settle/context.js";
import { hasRunActivity, notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveCompeteGroupTo, driveIdleRunTo } from "./transitions.js";
import { insertTurn, scheduleTurn } from "./turn-scheduling.js";
import type { TurnContext } from "./types.js";

/** Every turn runs in the run's own worktree; a missing one fails the step here, never at the provider. */
function canonicalWorktreePath(state: SupervisorState, run: RunRow): string {
  const path = state.repositories.forRepository(run.repository_id)?.service.get(run.id)?.path;
  if (path === undefined) {
    throw new Error(`run ${run.id} cannot continue without its worktree`);
  }
  return path;
}

async function startCompeteGroup(
  state: SupervisorState,
  run: RunRow,
  groupId: string,
  competitors: readonly RunPlanCompetitor[],
): Promise<void> {
  const group = getCompeteGroup(state.db, groupId);
  if (!group) throw new Error(`run ${run.id} compete group ${groupId} is missing`);
  const sessions = listAgentSessionsForRun(state.db, run.id);
  const sessionStepIds = new Set(sessions.map((session) => session.step_run_id));
  const unstarted = competitors.filter((competitor) => !sessionStepIds.has(competitor.id));
  if (unstarted.length === 0) return;

  const binding = state.repositories.forRepository(run.repository_id);
  if (!binding) throw new Error(`run ${run.id} compete group requires a Git repository`);
  if (group.base_head_sha === null) {
    updateCompeteGroupBase(state.db, group.id, binding.service.snapshot(run.id).headSha);
  }

  const initCommands = repositoryInitCommands(state.db, run.repository_id);
  const acquired: { competitor: RunPlanCompetitor; worktree: WorktreeRecord }[] = [];
  let contexts: TurnContext[];
  try {
    for (const competitor of unstarted) {
      acquired.push({
        competitor,
        worktree: binding.service.acquire({
          owner: competitor.id,
          branch: `${run.branch}--compete-${competitor.id}`,
          baseRef: run.branch,
        }),
      });
    }
    contexts = state.db.transaction(
      () =>
        acquired.map(({ competitor, worktree }) => {
          attachStepWorktree(state.db, competitor.id, worktree.id);
          const ctx = insertTurn(state, run, competitor, worktree.path);
          return initCommands.length === 0
            ? ctx
            : { ...ctx, worktreeInit: { commands: initCommands, label: competitor.name } };
        }),
      { behavior: "immediate" },
    );
  } catch (error) {
    for (const { competitor } of acquired) {
      try {
        binding.service.cleanup(competitor.id);
      } catch (cleanupError) {
        console.error(
          `[otomat] worktree rollback for competitor ${competitor.id} failed`,
          cleanupError,
        );
      }
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
  const next = readyPlanWork(
    run.plan_json,
    stepStatuses(steps),
    competeGroupStatuses(listCompeteGroupsForRun(state.db, run.id)),
  );
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
