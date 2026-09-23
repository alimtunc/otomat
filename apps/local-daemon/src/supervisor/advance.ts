import {
  attachStepWorktree,
  getCompeteGroup,
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  updateCompeteGroupBase,
  type RunRow,
} from "@otomat/db";
import { isRunWorking, readyPlanWork, type RunPlanCompetitor } from "@otomat/domain";

import type { WorktreeRecord } from "#git";
import { serializeByKey } from "#serialize";

import { failIdleRun, failureReason } from "./fail-run.js";
import { repositoryInitCommands, runStillLive } from "./init-commands.js";
import { spawnTurn } from "./lifecycle.js";
import { finishSettle } from "./pass-boundary.js";
import { reopenSettledRun } from "./resume.js";
import { planStatuses } from "./settle/context.js";
import { settleRun } from "./settle/index.js";
import { hasRunActivity, trackPending, type SupervisorState } from "./state.js";
import { advanceSupervision } from "./supervision/advance.js";
import { driveCompeteGroupTo } from "./transitions.js";
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
): Promise<boolean> {
  const group = getCompeteGroup(state.db, groupId);
  if (!group) throw new Error(`run ${run.id} compete group ${groupId} is missing`);
  const sessions = listAgentSessionsForRun(state.db, run.id);
  const sessionStepIds = new Set(sessions.map((session) => session.step_run_id));
  const unstarted = competitors.filter((competitor) => !sessionStepIds.has(competitor.id));
  if (unstarted.length === 0) return false;

  const binding = state.repositories.forRepository(run.repository_id);
  if (!binding) throw new Error(`run ${run.id} compete group requires a Git repository`);
  if (group.base_head_sha === null) {
    updateCompeteGroupBase(state.db, group.id, (await binding.service.snapshot(run.id)).headSha);
  }

  const initCommands = repositoryInitCommands(state.db, run.repository_id);
  const acquired: { competitor: RunPlanCompetitor; worktree: WorktreeRecord }[] = [];
  const releaseAcquired = async (): Promise<void> => {
    for (const { competitor } of acquired) {
      try {
        await binding.service.cleanup(competitor.id);
      } catch (cleanupError) {
        console.error(
          `[otomat] worktree rollback for competitor ${competitor.id} failed`,
          cleanupError,
        );
      }
    }
  };
  let contexts: TurnContext[];
  try {
    for (const competitor of unstarted) {
      acquired.push({
        competitor,
        worktree: await binding.service.acquire({
          owner: competitor.id,
          branch: `${run.branch}--compete-${competitor.id}`,
          baseRef: run.branch,
        }),
      });
    }
    // An abort or shutdown that landed during the acquisitions owns the run: nothing is inserted for it.
    if (!runStillLive(state, run.id)) {
      await releaseAcquired();
      return true;
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
    await releaseAcquired();
    driveCompeteGroupTo(state.db, group.id, group.status, "failed");
    throw error;
  }
  if (group.status === "queued" || group.status === "awaiting_human") {
    driveCompeteGroupTo(state.db, group.id, group.status, "running");
  }
  const launches = contexts.map((ctx) => scheduleTurn(state, ctx));
  await launches[0];
  return true;
}

function nextReadyWork(state: SupervisorState, run: RunRow) {
  const { statuses, groups } = planStatuses(state.db, run.id);
  return readyPlanWork(run.plan_json, statuses, groups);
}

/** Starts the next ready plan node; a compete node schedules all candidates under the global semaphore. */
export async function startNextReadyStep(state: SupervisorState, run: RunRow): Promise<boolean> {
  const next = nextReadyWork(state, run);
  if (next === null) return false;
  if (next.kind === "compete") {
    return startCompeteGroup(state, run, next.group.id, next.competitors);
  }

  const ctx = insertTurn(state, run, next.step, canonicalWorktreePath(state, run));
  await spawnTurn(state, ctx, "run", null);
  const spawned = getStepRun(state.db, next.step.id);
  if (!spawned) throw new Error(`step ${next.step.id} vanished immediately after spawn`);
  // A cancel that landed during the slot wait withdrew the step and unqueued this turn; the pass still owes the plan its next node.
  if (spawned.status === "withdrawn") return startNextReadyStep(state, run);
  return true;
}

/** A working run whose plan can no longer move would keep its status until the next boot reconciliation. */
async function convergeIdleRun(state: SupervisorState, runId: string): Promise<void> {
  const current = getRun(state.db, runId);
  if (!current || !isRunWorking(current.status) || hasRunActivity(state, runId)) return;
  // No live turn to judge: a session row an earlier settle left open must not be re-settled as this run's turn.
  const outcome = settleRun(state.db, state.dataDir, current, {
    mode: "live",
    turn: null,
    now: new Date().toISOString(),
  });
  if (outcome === null) return;
  console.log(`[otomat] run ${runId} had no step left to start; converged: ${outcome.reason}`);
  await finishSettle(state, outcome);
}

export async function startNextStepOrConverge(state: SupervisorState, run: RunRow): Promise<void> {
  // Supervision runs first: a delivered step is not a released dependency until its run's supervisor says so.
  const supervision = run.supervision_json;
  if (supervision !== null && (await advanceSupervision(state, run, supervision))) return;
  if (!(await startNextReadyStep(state, run))) await convergeIdleRun(state, run.id);
}

/** Background variant of `startNextStepOrConverge`: the caller never waits for a slot, and a failure fails the run. */
export function scheduleNextStep(state: SupervisorState, run: RunRow): Promise<void> {
  return trackPending(
    state,
    // Queued behind the run's pass in flight: a pass awaits git between reading its ready node and claiming it.
    serializeByKey(state.advancing, run.id, async () => {
      const current = getRun(state.db, run.id);
      if (!current || !runStillLive(state, run.id)) return;
      // A live turn owns the workspace: the work waits for it rather than starting beside it.
      if (hasRunActivity(state, run.id)) return startAfterLiveTurns(state, run.id);
      await startNextStepOrConverge(state, current);
    }).catch((error: unknown) => {
      console.error(`[otomat] run ${run.id} failed to start its next step`, error);
      return failIdleRun(state, run.id, `next work failed to start: ${failureReason(error)}`);
    }),
  );
}

/** The live turn's advance starts the appended work, unless its settle already rested the run — which only the turn's end can tell. */
export function startAfterLiveTurns(state: SupervisorState, runId: string): void {
  const monitors = [...state.inflight.values()]
    .filter((handle) => handle.runId === runId)
    .map((handle) => handle.monitor);
  void trackPending(
    state,
    Promise.all(monitors)
      .then(() => {
        if (hasRunActivity(state, runId) || state.aborting.has(runId)) return;
        const run = getRun(state.db, runId);
        if (!run || isRunWorking(run.status) || nextReadyWork(state, run) === null) return;
        return scheduleNextStep(state, reopenSettledRun(state, run));
      })
      .catch((error: unknown) => {
        console.error(`[otomat] run ${runId} failed to start its appended step`, error);
        return failIdleRun(state, runId, `next work failed to start: ${failureReason(error)}`);
      }),
  );
}

/** Live chain after completed work. Run-level scheduling is serialized while sibling sessions remain concurrent. */
export async function advanceRun(state: SupervisorState, runId: string): Promise<void> {
  const run = getRun(state.db, runId);
  if (!run || run.status !== "running") return;
  // A pass in flight reads the plan when it runs, and a turn's monitor must not wait behind it.
  if (hasRunActivity(state, runId) || state.aborting.has(runId) || state.advancing.has(runId)) {
    return;
  }

  await serializeByKey(state.advancing, runId, async () => {
    try {
      await startNextStepOrConverge(state, run);
    } catch (error) {
      console.error(`[otomat] run ${runId} failed to start its next work`, error);
      await failIdleRun(state, runId, `next work failed to start: ${failureReason(error)}`);
    }
  });
}
