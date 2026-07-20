import { recordAgentSessionExit, type AgentSessionRow, type Db } from "@otomat/db";
import { agentSessionMachine } from "@otomat/domain";

import { sessionDir } from "#events";

import { isReapableWorker } from "../identity.js";
import { isProcessAlive, killProcessGroup } from "../process.js";
import type { SettleOptions } from "./context.js";

export function recordObservedExit(
  db: Db,
  turnSession: AgentSessionRow | null,
  options: SettleOptions,
): void {
  if (!options.observedExit || turnSession === null || turnSession.pid === null) return;
  recordAgentSessionExit(db, turnSession.id, {
    exit_code: options.observedExit.code,
    exit_signal: options.observedExit.signal,
  });
}

export function reapProcesses(
  db: Db,
  dataDir: string,
  runId: string,
  sessions: readonly AgentSessionRow[],
  options: SettleOptions,
): boolean {
  let orphanTerminated = false;
  for (const session of sessions) {
    if (options.mode !== "boot" || session.pid === null || session.pid <= 1) continue;
    if (agentSessionMachine.isTerminal(session.status)) continue;
    if (!isProcessAlive(session.pid)) continue;
    // The pid is alive — but after a long downtime the OS may have reused it. Only signal when the
    // process identity still proves it is our worker; otherwise leave it and settle from the ledger.
    if (!isReapableWorker(sessionDir(dataDir, runId, session.id), session.pid)) {
      console.error(
        `[otomat] session ${session.id}: pid ${session.pid} is alive but its identity is unproven ` +
          `(possible pid reuse); not signalling — settling from ledger evidence`,
      );
      continue;
    }
    killProcessGroup(session.pgid ?? session.pid, "SIGKILL");
    recordAgentSessionExit(db, session.id, { exit_code: null, exit_signal: "SIGKILL" });
    orphanTerminated = true;
  }
  return orphanTerminated;
}
