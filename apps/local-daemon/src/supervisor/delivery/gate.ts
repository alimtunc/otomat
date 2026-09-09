import { getStepRun, listPendingRunInteractionsForSession, type AgentSessionRow } from "@otomat/db";
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
import type { SessionRef } from "../markers.js";
import type { SettleContext, SettleEvidence } from "../settle/context.js";
import { buildDeliveryBlockedEvent } from "./events.js";
import type { WorktreeDelta } from "./worktree.js";

export interface DeliveryGateInput {
  ctx: SettleContext;
  /** `null` on a run whose frozen plan no longer parses; the node's declared expectation is then unknowable. */
  plan: RunPlan | null;
  session: AgentSessionRow;
  /** The turn's own ledger slice: what it ran is read there, never from what it said about itself. */
  events: readonly EventEnvelope[];
  evidence: SettleEvidence;
}

const NO_PROBE = "this settle could not read the workspace";

const UNREADABLE: WorktreeDelta = {
  changed_files: 0,
  committed: false,
  end_tree_sha: null,
  end_head_sha: null,
  evidence_error: NO_PROBE,
};

function observeDelivery(input: DeliveryGateInput): DeliveryEvidence {
  const { ctx, session } = input;
  const delta = ctx.options.worktreeDelta?.({ runId: ctx.run.id, session }) ?? UNREADABLE;
  const commands = collectReportedCommands(input.events);
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

/** The controller's last word on a turn that ended cleanly: a zero exit is a process fact, not a delivery. */
export function gateDelivery(input: DeliveryGateInput): SettleEvidence {
  const { ctx, plan, session, evidence } = input;
  if (evidence.classification !== "completed") return evidence;
  // A competition is settled by the operator picking a winner; holding a candidate would strand its group.
  if (getStepRun(ctx.db, session.step_run_id)?.compete_group_id) return evidence;
  const node = plan === null ? undefined : planStepFor(plan, session.step_run_id);
  const expectation = node?.delivery ?? DEFAULT_DELIVERY_EXPECTATION;
  const observed = observeDelivery(input);
  const refusal = deliveryRefusal(expectation, observed);
  if (refusal === null) return evidence;
  const ref: SessionRef = {
    runId: ctx.run.id,
    stepRunId: session.step_run_id,
    agentSessionId: session.id,
  };
  emitLedgerEvent(
    ctx.db,
    ctx.dataDir,
    ctx.run.id,
    buildDeliveryBlockedEvent(ref, expectation, refusal, observed, ctx.options.now),
  );
  return {
    ...evidence,
    classification: "undelivered",
    reason: refusal,
    targets: TARGETS.undelivered,
  };
}
