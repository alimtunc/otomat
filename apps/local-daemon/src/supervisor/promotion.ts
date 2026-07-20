import {
  CompeteWinnerConflictError,
  claimCompeteWinner,
  getCompeteGroup,
  getRun,
  listActiveRuns,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  type CompeteGroupRow,
  type RunRow,
} from "@otomat/db";
import { allStepsSucceeded, readyPlanWork } from "@otomat/domain";

import { advanceRun } from "./advance.js";
import { competeGroupStatuses, stepStatuses } from "./settle/context.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveCompeteGroupTo, driveRunTo } from "./transitions.js";
import type { ReconcileOutcome } from "./types.js";

function requireSelectionScope(
  state: SupervisorState,
  runId: string,
  groupId: string,
): { run: RunRow; group: CompeteGroupRow } {
  const run = getRun(state.db, runId);
  if (!run) throw new CompeteWinnerConflictError(groupId, `run ${runId} not found`);
  const group = getCompeteGroup(state.db, groupId);
  if (!group || group.run_id !== runId) {
    throw new CompeteWinnerConflictError(groupId, `group does not belong to run ${runId}`);
  }
  return { run, group };
}

function archiveCandidates(state: SupervisorState, run: RunRow, groupId: string): void {
  const service = state.repositories.forRepository(run.repository_id)?.service;
  if (!service) {
    throw new Error(`run ${run.id} compete group ${groupId} has no repository to archive into`);
  }
  const candidates = listStepRunsForRun(state.db, run.id).filter(
    (step) => step.compete_group_id === groupId,
  );
  for (const candidate of candidates) {
    if (service.get(candidate.id)) service.archive(candidate.id);
  }
}

/** Rests a run whose whole plan is now satisfied; a run with work left stays `running` for the scheduler. */
function finishSelectedGroup(state: SupervisorState, run: RunRow): void {
  const current = getRun(state.db, run.id);
  if (!current || current.status !== "running" || hasRunActivity(state, run.id)) return;
  const steps = listStepRunsForRun(state.db, run.id);
  const groups = listCompeteGroupsForRun(state.db, run.id);
  if (allStepsSucceeded(current.plan_json, stepStatuses(steps), competeGroupStatuses(groups))) {
    driveRunTo(state.db, run.id, current.status, "review_ready", new Date().toISOString());
  }
}

/** Archives every candidate worktree, then chains the dependent work the selection just unblocked. */
async function unlockAfterSelection(
  state: SupervisorState,
  run: RunRow,
  groupId: string,
): Promise<void> {
  archiveCandidates(state, run, groupId);
  await advanceRun(state, run.id);
  finishSelectedGroup(state, run);
}

/** Atomically reserves one succeeded candidate, fast-forwards canonical, archives every candidate and unlocks dependents. */
export async function selectCompeteWinner(
  state: SupervisorState,
  runId: string,
  groupId: string,
  stepRunId: string,
): Promise<void> {
  const scoped = requireSelectionScope(state, runId, groupId);
  const service = state.repositories.forRepository(scoped.run.repository_id)?.service;
  if (!service) {
    throw new CompeteWinnerConflictError(groupId, "competition repository is unavailable");
  }
  if (scoped.group.status === "selected") {
    if (scoped.group.winner_step_run_id !== stepRunId) {
      throw new CompeteWinnerConflictError(groupId, "another winner is already selected");
    }
    if (scoped.run.status === "awaiting_selection") {
      driveRunTo(state.db, runId, scoped.run.status, "running", new Date().toISOString());
    }
    return unlockAfterSelection(state, scoped.run, groupId);
  }

  const claimed = claimCompeteWinner(state.db, groupId, stepRunId);
  if (claimed.base_head_sha === null) {
    throw new CompeteWinnerConflictError(groupId, "competition base commit is missing");
  }
  service.promote(stepRunId, runId, claimed.base_head_sha);

  driveCompeteGroupTo(state.db, groupId, claimed.status, "selected");
  const current = getRun(state.db, runId);
  if (!current) throw new Error(`run ${runId} vanished after winner promotion`);
  driveRunTo(state.db, runId, current.status, "running", new Date().toISOString());
  return unlockAfterSelection(state, current, groupId);
}

function restRecoveredRun(state: SupervisorState, runId: string): void {
  const run = getRun(state.db, runId);
  if (!run || run.status !== "running") return;
  const steps = listStepRunsForRun(state.db, run.id);
  const groups = listCompeteGroupsForRun(state.db, run.id);
  const statuses = stepStatuses(steps);
  const groupStates = competeGroupStatuses(groups);
  let target: "review_ready" | "awaiting_human" | "failed" = "failed";
  if (allStepsSucceeded(run.plan_json, statuses, groupStates)) target = "review_ready";
  else if (readyPlanWork(run.plan_json, statuses, groupStates)) target = "awaiting_human";
  driveRunTo(state.db, run.id, run.status, target, new Date().toISOString());
}

/** Completes a winner reservation interrupted by daemon exit, but never auto-starts dependent work on boot. */
export function recoverCompeteSelections(state: SupervisorState): ReconcileOutcome[] {
  const outcomes: ReconcileOutcome[] = [];
  for (const run of listActiveRuns(state.db).runs) {
    for (const group of listCompeteGroupsForRun(state.db, run.id)) {
      if (group.status !== "promoting" && group.status !== "selected") continue;
      const winnerId = group.winner_step_run_id;
      if (!winnerId) continue;
      try {
        if (group.status === "promoting") {
          const service = state.repositories.forRepository(run.repository_id)?.service;
          if (!service) throw new Error("competition repository is unavailable");
          if (!group.base_head_sha) throw new Error("competition base commit is missing");
          service.promote(winnerId, run.id, group.base_head_sha);
          driveCompeteGroupTo(state.db, group.id, group.status, "selected");
        }
        const current = getRun(state.db, run.id);
        if (current?.status === "awaiting_selection") {
          driveRunTo(state.db, run.id, current.status, "running", new Date().toISOString());
        }
        archiveCandidates(state, run, group.id);
        restRecoveredRun(state, run.id);
        outcomes.push({
          runId: run.id,
          classification: "completed",
          reason: "recovered reserved compete winner; dependent work awaits explicit resume",
          orphanTerminated: false,
          providerSessionId: null,
        });
      } catch (error) {
        console.error(`[otomat] compete winner recovery failed for group ${group.id}`, error);
        // Re-read: a throw after a successful promote must not overwrite the `selected` row it just wrote.
        const stalled = getCompeteGroup(state.db, group.id);
        if (stalled?.status !== "promoting") continue;
        driveCompeteGroupTo(state.db, group.id, stalled.status, "failed");
        const current = getRun(state.db, run.id);
        if (current && current.status !== "failed") {
          driveRunTo(state.db, run.id, current.status, "failed", new Date().toISOString());
        }
      }
    }
  }
  return outcomes;
}
