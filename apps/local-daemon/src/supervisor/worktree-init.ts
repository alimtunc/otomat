import { getRepository, getRun, listStepRunsForRun, type Db, type RunRow } from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";
import { runCliProcess } from "#runtime/cli/process-runner";

import { startNextReadyStep } from "./advance.js";
import { buildTerminalMarker } from "./markers.js";
import { hasRunActivity, notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveIdleRunTo, driveRunTo } from "./transitions.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

export function repositoryInitCommands(db: Db, repositoryId: string | null): string[] {
  if (repositoryId === null) return [];
  return getRepository(db, repositoryId)?.init_commands_json ?? [];
}

function emitInitLog(
  state: SupervisorState,
  runId: string,
  stream: "stdout" | "stderr",
  text: string,
): void {
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildRuntimeEvent({
      runId,
      kind: "runtime.log",
      type: "runtime.log",
      source: "otomat",
      adapter: SUPERVISOR_ADAPTER,
      fidelity: "raw_log",
      occurredAt: new Date().toISOString(),
      payload: { stream, text },
    }),
  );
}

/** True when the run may keep initializing; anything settled elsewhere stops silently. */
function runStillPreparing(state: SupervisorState, runId: string): boolean {
  const current = getRun(state.db, runId);
  if (!current || runMachine.isTerminal(current.status)) return false;
  return !state.aborting.has(runId) && !state.shuttingDown;
}

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
  for (const command of commands) {
    if (!runStillPreparing(state, run.id)) return false;
    emitInitLog(state, run.id, "stderr", `[otomat] worktree init: $ ${command}`);
    const exit = await runCliProcess({
      command: "bash",
      args: ["-lc", command],
      cwd: worktreePath,
      stdin: "",
      signal: new AbortController().signal,
      onStdoutLine: (line) => emitInitLog(state, run.id, "stdout", line),
      onStderrLine: (line) => emitInitLog(state, run.id, "stderr", line),
    });
    if (exit.code !== 0) {
      const outcome =
        exit.code === null ? `signal ${exit.signal ?? "unknown"}` : `exit ${exit.code}`;
      throw new Error(`worktree init command \`${command}\` failed (${outcome})`);
    }
  }
  return runStillPreparing(state, run.id);
}

function failWorktreeInit(state: SupervisorState, runId: string, error: unknown): void {
  const current = getRun(state.db, runId);
  if (!current || runMachine.isTerminal(current.status) || hasRunActivity(state, runId)) return;
  const reason = error instanceof Error ? error.message : String(error);
  const now = new Date().toISOString();
  emitInitLog(state, runId, "stderr", `[otomat] ${reason}`);
  driveIdleRunTo(state.db, current, "failed", listStepRunsForRun(state.db, runId), now);
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildTerminalMarker({ runId, stepRunId: null, agentSessionId: null }, "failed", null, 0, now),
  );
  notifyAfterSettle(state, {
    runId,
    classification: "failed",
    reason,
    orphanTerminated: false,
    providerSessionId: null,
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
  let pending: Promise<void>;
  pending = performWorktreeInit(state, run, commands)
    .then(async (ready) => {
      if (!ready) return;
      const current = getRun(state.db, run.id);
      if (!current) return;
      await startNextReadyStep(state, current);
    })
    .catch((error: unknown) => {
      console.error(`[otomat] run ${run.id} worktree init failed`, error);
      failWorktreeInit(state, run.id, error);
    })
    .finally(() => state.pending.delete(pending));
  state.pending.add(pending);
  return pending;
}
