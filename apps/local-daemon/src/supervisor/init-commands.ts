import { getRepository, getRun, type Db } from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { buildRuntimeEvent } from "#runtime";
import { runCliProcess } from "#runtime/cli/process-runner";

import type { SupervisorState } from "./state.js";
import { SUPERVISOR_ADAPTER } from "./types.js";

export function repositoryInitCommands(db: Db, repositoryId: string | null): string[] {
  if (repositoryId === null) return [];
  return getRepository(db, repositoryId)?.init_commands_json ?? [];
}

export function emitInitLog(
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

export interface InitCommandBatch {
  worktreePath: string;
  commands: string[];
  /** Prefixes each command header so a compete candidate's log lines stay attributable; null on the run's own worktree. */
  label: string | null;
  /** Re-checked between commands; false stops the batch silently — the state that settled the run owns the outcome. */
  shouldContinue: () => boolean;
}

/** True when the run may keep going; anything settled elsewhere stops the caller silently. */
export function runStillLive(state: SupervisorState, runId: string): boolean {
  const current = getRun(state.db, runId);
  if (!current || runMachine.isTerminal(current.status)) return false;
  return !state.aborting.has(runId) && !state.shuttingDown;
}

/**
 * Runs one worktree's init commands in order, streaming their output to the run
 * log. Throws on the first failing command; resolves false when stopped early.
 */
export async function runInitCommandBatch(
  state: SupervisorState,
  runId: string,
  batch: InitCommandBatch,
): Promise<boolean> {
  const prefix = batch.label === null ? "worktree init" : `worktree init [${batch.label}]`;
  for (const command of batch.commands) {
    if (!batch.shouldContinue()) return false;
    emitInitLog(state, runId, "stderr", `[otomat] ${prefix}: $ ${command}`);
    const exit = await runCliProcess({
      command: "bash",
      args: ["-lc", command],
      cwd: batch.worktreePath,
      stdin: "",
      signal: new AbortController().signal,
      onStdoutLine: (line) => emitInitLog(state, runId, "stdout", line),
      onStderrLine: (line) => emitInitLog(state, runId, "stderr", line),
    });
    if (exit.code !== 0) {
      const outcome =
        exit.code === null ? `signal ${exit.signal ?? "unknown"}` : `exit ${exit.code}`;
      throw new Error(`worktree init command \`${command}\` failed (${outcome})`);
    }
  }
  return batch.shouldContinue();
}
