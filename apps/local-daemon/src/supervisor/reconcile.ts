import { listActiveRuns, type Db } from "@otomat/db";
import type { RunState } from "@otomat/domain";

import { settleRun } from "./settle/index.js";
import type { ReconcileOutcome, ReconcileReport } from "./types.js";

/** Non-terminal states a crash must not disturb: they await an explicit human action, not a process. */
const RESTING_RUN_STATES: ReadonlySet<RunState> = new Set(["review_ready", "awaiting_human"]);

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
    const outcome = settleRun(db, dataDir, run, { mode: "boot", now });
    if (outcome !== null) reconciled.push(outcome);
  }
  return { reconciled };
}
