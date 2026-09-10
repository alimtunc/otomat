import { listPendingRunInteractionsForSession, type AgentSessionRow } from "@otomat/db";
import {
  collectReportedCommands,
  DEFAULT_DELIVERY_EXPECTATION,
  deliveryRefusal,
  planStepFor,
  type DeliveryEvidence,
  type EventEnvelope,
  type RunPlan,
} from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { TARGETS } from "../classify.js";
import { sessionRef } from "../markers.js";
import type { SettleContext, SettleEvidence } from "../settle/context.js";
import { buildDeliveryBlockedEvent } from "./events.js";

function observeDelivery(
  ctx: SettleContext,
  session: AgentSessionRow,
  events: readonly EventEnvelope[],
): DeliveryEvidence {
  const delta = ctx.options.worktreeDelta({ runId: ctx.run.id, session });
  const commands = collectReportedCommands(events);
  return {
    start_tree_sha: session.start_tree_sha,
    start_head_sha: session.start_head_sha,
    end_tree_sha: delta.end_tree_sha,
    end_head_sha: delta.end_head_sha,
    changed_files: delta.changed_files,
    committed: delta.committed,
    observed_commands: commands.length,
    failed_commands: commands.filter((command) => command.outcome === "failed").length,
    pending_interactions: listPendingRunInteractionsForSession(ctx.db, session.id).length,
    evidence_error: delta.evidence_error,
  };
}

/** The controller's last word on a turn that ended cleanly: a zero exit is a process fact, not a delivery. `plan` is null on a run whose frozen plan no longer parses. */
export function gateDelivery(
  ctx: SettleContext,
  plan: RunPlan | null,
  session: AgentSessionRow,
  events: readonly EventEnvelope[],
  evidence: SettleEvidence,
): SettleEvidence {
  if (evidence.classification !== "completed") return evidence;
  const node = plan === null ? undefined : planStepFor(plan, session.step_run_id);
  const expectation = node?.delivery ?? DEFAULT_DELIVERY_EXPECTATION;
  const observed = observeDelivery(ctx, session, events);
  const refusal = deliveryRefusal(expectation, observed);
  if (refusal === null) return evidence;
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildDeliveryBlockedEvent(
      sessionRef(ctx.run.id, session),
      expectation,
      refusal,
      observed,
      ctx.options.now,
    ),
  );
  return {
    ...evidence,
    classification: "undelivered",
    reason: refusal,
    targets: TARGETS.undelivered,
  };
}
