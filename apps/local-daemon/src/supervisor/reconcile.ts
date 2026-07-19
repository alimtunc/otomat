import { getRun, listActiveRuns, listAgentSessionsForRun, type Db } from "@otomat/db";
import { agentSessionMachine, type RunState } from "@otomat/domain";

import { settleRun } from "./settle/index.js";
import type { ReconcileOutcome, ReconcileReport } from "./types.js";

/** Non-terminal states a crash must not disturb: they await an explicit human action, not a process. */
const RESTING_RUN_STATES: ReadonlySet<RunState> = new Set([
  "review_ready",
  "awaiting_human",
  "awaiting_selection",
]);

/** Boot pass: settle every in-flight run left non-terminal by a crash or kill. */
export function reconcileRuns(db: Db, dataDir: string, now: string): ReconcileReport {
  const active = listActiveRuns(db);
  for (const run of active.corrupt) {
    console.error(
      `[otomat] run ${run.id} has an invalid plan_json; settling it from ledger evidence`,
      run.issues,
    );
  }
  const reconciled: ReconcileOutcome[] = [];
  for (const run of [...active.runs, ...active.corrupt]) {
    if (RESTING_RUN_STATES.has(run.status)) continue;
    const openSessions = listAgentSessionsForRun(db, run.id).filter(
      (session) => !agentSessionMachine.isTerminal(session.status),
    );
    const turns = openSessions.length > 0 ? openSessions : [null];
    for (const session of turns) {
      const current = getRun(db, run.id);
      if (!current || RESTING_RUN_STATES.has(current.status)) break;
      const outcome = settleRun(db, dataDir, current, {
        mode: "boot",
        ...(session ? { turn: { agentSessionId: session.id } } : {}),
        now,
      });
      if (outcome !== null) reconciled.push(outcome);
    }
  }
  return { reconciled };
}
