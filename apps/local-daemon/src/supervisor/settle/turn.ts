import type { AgentSessionRow } from "@otomat/db";
import {
  allStepsSucceeded,
  nextReadyStep,
  stepRunMachine,
  type RunPlan,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

import { driveTurnConvergence } from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import {
  stepStatuses,
  type SettleContext,
  type SettleEvidence,
  type SettleOptions,
} from "./context.js";
import { emitReconciled } from "./ledger.js";

interface RunResolution {
  run: RunState;
  cancelRemaining: boolean;
}

/** A completed step with more work chains live but rests at `awaiting_human` on boot (no auto-run after restart); failure/cancel are fail-fast. */
function resolveRunTarget(
  classification: ReconcileClassification,
  plan: RunPlan,
  projected: Map<string, StepRunState>,
  mode: SettleOptions["mode"],
): RunResolution {
  if (classification === "completed") {
    if (allStepsSucceeded(plan, projected)) return { run: "review_ready", cancelRemaining: false };
    if (nextReadyStep(plan, projected) !== null) {
      return { run: mode === "live" ? "running" : "awaiting_human", cancelRemaining: false };
    }
    return { run: "failed", cancelRemaining: true };
  }
  if (classification === "interrupted") return { run: "awaiting_human", cancelRemaining: false };
  if (classification === "canceled") return { run: "canceled", cancelRemaining: true };
  return { run: "failed", cancelRemaining: true };
}

/** Converges one live-tracked (or still-open) turn: its step/session, the fail-fast remainder, and the run. */
export function settleTurn(
  ctx: SettleContext,
  plan: RunPlan,
  turnSession: AgentSessionRow,
  evidence: SettleEvidence,
): ReconcileOutcome {
  const { classification, reason, providerSessionId, targets } = evidence;

  const turnStep = ctx.steps.find((step) => step.id === turnSession.step_run_id) ?? null;
  const projected = stepStatuses(ctx.steps);
  if (turnStep !== null && !stepRunMachine.isTerminal(turnStep.status)) {
    projected.set(turnStep.id, targets.step);
  }
  const resolution = resolveRunTarget(classification, plan, projected, ctx.options.mode);
  const cancelSteps = resolution.cancelRemaining
    ? ctx.steps.filter((step) => step.id !== turnStep?.id)
    : [];

  driveTurnConvergence(
    ctx.db,
    ctx.run,
    { step: turnStep, session: turnSession },
    { ...targets, run: resolution.run },
    cancelSteps,
    ctx.options.now,
  );

  emitReconciled(ctx, {
    ref: { runId: ctx.run.id, stepRunId: turnStep?.id ?? null, agentSessionId: turnSession.id },
    classification,
    reason,
    providerSessionId,
    orphanTerminated: ctx.orphanTerminated,
  });
  return {
    runId: ctx.run.id,
    classification,
    reason,
    orphanTerminated: ctx.orphanTerminated,
    providerSessionId,
  };
}
