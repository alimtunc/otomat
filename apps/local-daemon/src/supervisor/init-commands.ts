import { getRepository, getRun, type Db } from "@otomat/db";
import { isRunSettled } from "@otomat/domain";

import { runCliProcess } from "#runtime/cli/process-runner";

import { emitSupervisorLog } from "./run-log.js";
import type { SupervisorState } from "./state.js";

export function repositoryInitCommands(db: Db, repositoryId: string | null): string[] {
  if (repositoryId === null) return [];
  return getRepository(db, repositoryId)?.init_commands_json ?? [];
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
  if (!current || isRunSettled(current.status)) return false;
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
  const interrupt = new AbortController();
  const interrupts = state.initInterrupts.get(runId) ?? new Set();
  interrupts.add(interrupt);
  state.initInterrupts.set(runId, interrupts);
  try {
    for (const command of batch.commands) {
      if (!batch.shouldContinue()) return false;
      emitSupervisorLog(state, runId, "stderr", `[otomat] ${prefix}: $ ${command}`);
      const exit = await runCliProcess({
        command: "bash",
        args: ["-lc", command],
        cwd: batch.worktreePath,
        stdin: "",
        signal: interrupt.signal,
        onStdoutLine: (line) => emitSupervisorLog(state, runId, "stdout", line),
        onStderrLine: (line) => emitSupervisorLog(state, runId, "stderr", line),
      });
      if (exit.code !== 0) {
        // A command the abort killed is not the batch's own failure; the settling state owns the outcome.
        if (exit.aborted) return false;
        const outcome =
          exit.code === null ? `signal ${exit.signal ?? "unknown"}` : `exit ${exit.code}`;
        throw new Error(`worktree init command \`${command}\` failed (${outcome})`);
      }
    }
    return batch.shouldContinue();
  } finally {
    interrupts.delete(interrupt);
    if (interrupts.size === 0) state.initInterrupts.delete(runId);
  }
}
