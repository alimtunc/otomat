import { listPendingRunInteractionsForSession, type AgentSessionRow } from "@otomat/db";

import { emitLedgerEvent } from "#events";

import { TARGETS } from "../classify.js";
import { sessionRef } from "../markers.js";
import type { SettleContext, SettleEvidence } from "../settle/context.js";
import { buildDeliveryBlockedEvent } from "./events.js";

const UNANSWERED =
  "The turn ended while a question it asked was still unanswered; a process exit does not answer it.";

/** The controller's last word on a turn that ended cleanly: a zero exit is a process fact, and an open ask is not answered by it. */
export function gateDelivery(
  ctx: SettleContext,
  session: AgentSessionRow,
  evidence: SettleEvidence,
): SettleEvidence {
  if (evidence.classification !== "completed") return evidence;
  const pending = listPendingRunInteractionsForSession(ctx.db, session.id).length;
  if (pending === 0) return evidence;
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildDeliveryBlockedEvent(
      sessionRef(ctx.run.id, session),
      UNANSWERED,
      pending,
      ctx.options.now,
    ),
  );
  return {
    ...evidence,
    classification: "undelivered",
    reason: UNANSWERED,
    targets: TARGETS.undelivered,
  };
}
