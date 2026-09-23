import {
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  type Db,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { isRunSettled, isRunWorking, stepSessions, withdrawalEmptiesPlan } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { buildStepWithdrawnEvent } from "./markers.js";
import { finishSettle } from "./pass-boundary.js";
import { planStatuses } from "./settle/context.js";
import { resolveIdleRun } from "./settle/idle.js";
import { settleRun } from "./settle/index.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveSessionTo, driveStepTo } from "./transitions.js";

export class StepCancelRefusedError extends Error {
  constructor(
    readonly code: "step_not_found" | "step_not_queued" | "step_last_work",
    message: string,
  ) {
    super(message);
    this.name = "StepCancelRefusedError";
  }
}

/** A run resting on work that no longer exists re-reads its plan; a working run has a pass in flight that will, and a settled one stays where the operator left it. */
async function resettleRestingRun(state: SupervisorState, run: RunRow, now: string): Promise<void> {
  if (isRunWorking(run.status) || isRunSettled(run.status) || hasRunActivity(state, run.id)) return;
  const { statuses, groups } = planStatuses(state.db, run.id);
  const resolution = resolveIdleRun(run.plan_json, statuses, groups);
  if (resolution.target === run.status) return;
  const outcome = settleRun(state.db, state.dataDir, run, { mode: "live", turn: null, now });
  if (outcome !== null) await finishSettle(state, outcome);
}

function requireWithdrawableStep(db: Db, runId: string, stepRunId: string) {
  const run = getRun(db, runId);
  const step = getStepRun(db, stepRunId);
  if (!run || !step || step.run_id !== runId) {
    throw new StepCancelRefusedError("step_not_found", `step ${stepRunId} is not on run ${runId}`);
  }
  if (step.compete_group_id !== null) {
    throw new StepCancelRefusedError(
      "step_not_queued",
      `${step.name} is a competition candidate; cancel the run instead`,
    );
  }
  if (step.status !== "queued") {
    throw new StepCancelRefusedError(
      "step_not_queued",
      `${step.name} is ${step.status}; only a queued step can be canceled`,
    );
  }
  const { statuses, groups } = planStatuses(db, runId);
  if (withdrawalEmptiesPlan(run.plan_json, statuses, groups, stepRunId)) {
    throw new StepCancelRefusedError(
      "step_last_work",
      `${step.name} is the last work this run could do; cancel the run instead`,
    );
  }
  return { run, step };
}

export async function cancelQueuedStep(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
): Promise<StepRunRow> {
  const { db } = state;
  const { run, step } = requireWithdrawableStep(db, runId, stepRunId);
  const sessions = stepSessions(listAgentSessionsForRun(db, runId), stepRunId);
  const now = new Date().toISOString();
  db.transaction(
    () => {
      driveStepTo(db, stepRunId, "queued", "withdrawn");
      for (const session of sessions) {
        if (session.status === "created") driveSessionTo(db, session.id, "created", "terminated");
      }
    },
    { behavior: "immediate" },
  );
  emitLedgerEvent(
    db,
    state.dataDir,
    runId,
    buildStepWithdrawnEvent(runId, stepRunId, step.name, now),
  );
  for (const session of sessions) state.slots.cancel(session.id);
  await resettleRestingRun(state, run, now);

  const withdrawn = getStepRun(db, stepRunId);
  if (!withdrawn) throw new Error(`step ${stepRunId} vanished immediately after cancel`);
  return withdrawn;
}
