import { getRun, type RunRow } from "@otomat/db";

import { serializeByKey } from "#serialize";

import { startNextStepOrConverge } from "./advance.js";
import { failIdleRun, failureReason } from "./fail-run.js";
import { runInitCommandBatch, runStillLive } from "./init-commands.js";
import { trackPending, type SupervisorState } from "./state.js";
import { driveRunTo } from "./transitions.js";

async function performWorktreeInit(
  state: SupervisorState,
  run: RunRow,
  commands: string[],
): Promise<boolean> {
  const worktreePath = state.repositories
    .forRepository(run.repository_id)
    ?.service.get(run.id)?.path;
  if (worktreePath === undefined) {
    throw new Error(`run ${run.id} cannot run worktree init without its worktree`);
  }
  driveRunTo(state.db, run.id, run.status, "preparing", new Date().toISOString());
  return runInitCommandBatch(state, run.id, {
    worktreePath,
    commands,
    label: null,
    shouldContinue: () => runStillLive(state, run.id),
  });
}

/**
 * Runs the repository's init commands in the fresh run worktree, streaming
 * their output to the run log, then starts the first plan step. The launch
 * request returns immediately: init happens in the background, and a failing
 * command fails the run honestly instead of letting the agent start on a
 * half-initialized checkout.
 */
export function scheduleWorktreeInit(
  state: SupervisorState,
  run: RunRow,
  commands: string[],
): Promise<void> {
  return trackPending(
    state,
    // The run's pass: a sequential append during init queues behind it rather than starting on a half-initialized checkout.
    serializeByKey(state.advancing, run.id, async () => {
      if (!(await performWorktreeInit(state, run, commands))) return;
      const current = getRun(state.db, run.id);
      if (!current) return;
      await startNextStepOrConverge(state, current);
    }).catch((error: unknown) => {
      console.error(`[otomat] run ${run.id} worktree init failed`, error);
      return failIdleRun(state, run.id, failureReason(error));
    }),
  );
}
