import { emitLedgerEvent } from "#events";

import { buildReconciledEvent, type SessionRef } from "../markers.js";
import { driveRunConvergence } from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import type { SettleContext, SettleEvidence } from "./context.js";

interface ReconciledAudit {
  ref: SessionRef;
  classification: ReconcileClassification;
  reason: string;
  providerSessionId: string | null;
  orphanTerminated: boolean;
}

/** Emits the boot-only `system.reconciled` audit event and reports the settle's outcome. */
export function recordReconciled(ctx: SettleContext, audit: ReconciledAudit): ReconcileOutcome {
  if (ctx.options.mode === "boot") {
    const event = buildReconciledEvent(
      audit.ref,
      audit.classification,
      audit.reason,
      audit.providerSessionId,
      audit.orphanTerminated,
      ctx.options.now,
    );
    emitLedgerEvent(ctx.db, ctx.dataDir, ctx.run.id, event);
  }
  return {
    runId: ctx.run.id,
    classification: audit.classification,
    reason: audit.reason,
    orphanTerminated: audit.orphanTerminated,
    providerSessionId: audit.providerSessionId,
  };
}

/** Corrupt `plan_json`: no per-step truth to schedule from — converge everything from whole-ledger evidence. */
export function settleFromWholeLedger(
  ctx: SettleContext,
  evidence: SettleEvidence,
): ReconcileOutcome {
  const { classification, reason, providerSessionId, targets } = evidence;
  driveRunConvergence(ctx.db, ctx.run, ctx.steps, ctx.sessions, targets, ctx.options.now);
  return recordReconciled(ctx, {
    ref: {
      runId: ctx.run.id,
      stepRunId: ctx.steps[0]?.id ?? null,
      agentSessionId: ctx.sessions[0]?.id ?? null,
    },
    classification,
    reason,
    providerSessionId,
    orphanTerminated: ctx.orphanTerminated,
  });
}
