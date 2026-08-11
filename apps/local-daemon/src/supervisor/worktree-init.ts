import { getRun, type RunRow } from "@otomat/db";

import { startNextReadyStep } from "./advance.js";
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
    performWorktreeInit(state, run, commands)
      .then(async (ready) => {
        if (!ready) return;
        const current = getRun(state.db, run.id);
        if (!current) return;
        await startNextReadyStep(state, current);
      })
      .catch((error: unknown) => {
        console.error(`[otomat] run ${run.id} worktree init failed`, error);
        failIdleRun(state, run.id, failureReason(error));
      }),
  );
}
