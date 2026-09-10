import type { AgentSessionRow } from "@otomat/db";
import {
  parseSupervisionDecision,
  supervisionDecisionsFor,
  type EventEnvelope,
  type SupervisionEntry,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";
import { asString } from "#runtime";

import { cancelSessionInteractions, ingestRunInteractions } from "../interaction/index.js";
import { sessionRef } from "../markers.js";
import type { SettleContext } from "../settle/context.js";
import { recordReconciled } from "../settle/ledger.js";
import { driveRunTo, driveSessionTo } from "../transitions.js";
import type { ReconcileOutcome } from "../types.js";
import { buildSupervisionEvent } from "./events.js";

const NO_DECISION =
  "the supervisor turn ended without a readable decision block, so nothing was released";

function supervisorText(events: readonly EventEnvelope[]): string {
  return events
    .filter((event) => event.type === "runtime.message" && event.payload["thinking"] !== true)
    .map((event) => asString(event.payload["text"]) ?? "")
    .join("\n");
}

/** Writes the decision it could read and leaves the evaluated step where it was: the scheduler stays the only thing that unlocks work. */
export function settleSupervisionTurn(
  ctx: SettleContext,
  session: AgentSessionRow,
  events: readonly EventEnvelope[],
  runEvents: readonly EventEnvelope[],
): ReconcileOutcome {
  // Promoted before the cancel, exactly as a step turn settles: an unpromoted ask resurrects on the next turn.
  ingestRunInteractions(ctx.db, ctx.run.id);
  cancelSessionInteractions(
    ctx.db,
    ctx.dataDir,
    session.id,
    "the supervisor turn that asked this question ended before it was answered",
    ctx.options.now,
  );
  const decision = parseSupervisionDecision(supervisorText(events));
  const entry: SupervisionEntry =
    decision === null
      ? { state: "unavailable", reason: NO_DECISION }
      : {
          state: "decided",
          round: supervisionDecisionsFor(runEvents, session.step_run_id).length + 1,
          decision,
        };
  const ref = sessionRef(ctx.run.id, session);
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildSupervisionEvent(ref, entry, ctx.options.now),
  );
  ctx.db.transaction(
    () => {
      driveSessionTo(ctx.db, session.id, session.status, "terminated");
      driveRunTo(
        ctx.db,
        ctx.run.id,
        ctx.run.status,
        ctx.options.mode === "live" ? "running" : "awaiting_human",
        ctx.options.now,
      );
    },
    { behavior: "immediate" },
  );
  return recordReconciled(ctx, {
    ref,
    classification: entry.state === "decided" ? "completed" : "failed",
    reason:
      entry.state === "decided" ? `supervisor decided: ${entry.decision.decision}` : entry.reason,
    providerSessionId: null,
    orphanTerminated: ctx.orphanTerminated,
  });
}
