import type { AgentSessionRow } from "@otomat/db";

import { emitLedgerEvent } from "#events";

import { TARGETS } from "../classify.js";
import { sessionRef } from "../markers.js";
import type { SettleContext, SettleEvidence } from "../settle/context.js";
import { buildSupervisionEvent } from "./events.js";

const AWAITING =
  "this step delivered; the run's supervisor has to judge it before anything waits on it";

/** On a supervised run a delivered step is not yet a released dependency: the supervisor's absence blocks the plan. */
export function gateSupervision(
  ctx: SettleContext,
  session: AgentSessionRow,
  evidence: SettleEvidence,
): SettleEvidence {
  if (evidence.classification !== "completed" || !ctx.run.supervision_json) return evidence;
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildSupervisionEvent(sessionRef(ctx.run.id, session), { state: "pending" }, ctx.options.now),
  );
  return {
    ...evidence,
    classification: "awaiting_supervision",
    reason: AWAITING,
    targets: TARGETS.awaiting_supervision,
  };
}
