import { getStepRun, type AgentSessionRow } from "@otomat/db";

import { emitLedgerEvent } from "#events";

import { TARGETS } from "../classify.js";
import type { SettleContext, SettleEvidence } from "../settle/context.js";
import { buildSupervisionEvent } from "./ledger.js";

const AWAITING =
  "this step delivered; the run's supervisor has to judge it before anything waits on it";

/** On a supervised run a delivered step is not yet a released dependency: the supervisor's absence blocks the plan. */
export function gateSupervision(
  ctx: SettleContext,
  session: AgentSessionRow,
  evidence: SettleEvidence,
): SettleEvidence {
  if (evidence.classification !== "completed") return evidence;
  if (!ctx.run.supervision_json) return evidence;
  // A competition is settled by the operator picking a winner; supervising a losing candidate would judge work nobody keeps.
  if (getStepRun(ctx.db, session.step_run_id)?.compete_group_id) return evidence;
  const ref = {
    runId: ctx.run.id,
    stepRunId: session.step_run_id,
    agentSessionId: session.id,
  };
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildSupervisionEvent(ref, { state: "pending" }, ctx.options.now),
  );
  return {
    ...evidence,
    classification: "awaiting_supervision",
    reason: AWAITING,
    targets: TARGETS.awaiting_supervision,
  };
}
