import type { AgentSessionRow, StepRunRow } from "@otomat/db";
import {
  allStepsSucceeded,
  haltedPlanOutcome,
  isStepSettled,
  readyPlanWork,
  type RunPlan,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

import {
  driveCompeteGroupTo,
  driveRunTo,
  driveSessionTo,
  driveStepTo,
  driveTurnConvergence,
} from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import {
  competeGroupStatuses,
  stepStatuses,
  type SettleContext,
  type SettleEvidence,
  type SettleOptions,
} from "./context.js";
import { recordReconciled, recordRunLanding } from "./ledger.js";

interface RunResolution {
  run: RunState;
  cancelRemaining: boolean;
}

function recordTurnOutcome(
  ctx: SettleContext,
  session: AgentSessionRow,
  stepRunId: string | null,
  evidence: SettleEvidence,
  runStatus: RunState,
): ReconcileOutcome {
  const ref = { runId: ctx.run.id, stepRunId, agentSessionId: session.id };
  recordRunLanding(ctx, ref, runStatus);
  return recordReconciled(ctx, {
    ref,
    classification: evidence.classification,
    reason: evidence.reason,
    providerSessionId: evidence.providerSessionId,
    orphanTerminated: ctx.orphanTerminated,
  });
}

/** Candidate states that still owe the competition an outcome; `queued` counts because it has not started yet. */
const UNSETTLED_CANDIDATE_STATES: ReadonlySet<StepRunState> = new Set([
  "queued",
  "starting",
  "running",
  "awaiting_permission",
]);

interface CompeteTargets {
  group: "running" | "awaiting_selection" | "awaiting_human" | "failed";
  run: RunState;
}

function competeTargets(
  hasActive: boolean,
  hasSucceeded: boolean,
  hasResumable: boolean,
): CompeteTargets {
  if (hasActive) return { group: "running", run: "running" };
  if (hasSucceeded) return { group: "awaiting_selection", run: "awaiting_selection" };
  if (hasResumable) return { group: "awaiting_human", run: "awaiting_human" };
  return { group: "failed", run: "failed" };
}

/** A completed ordinary step chains live but rests at `awaiting_human` on boot; failure/cancel are fail-fast. */
function resolveRunTarget(
  ctx: SettleContext,
  classification: ReconcileClassification,
  plan: RunPlan,
  projected: Map<string, StepRunState>,
  mode: SettleOptions["mode"],
): RunResolution {
  if (classification === "completed") {
    if (allStepsSucceeded(plan, projected, competeGroupStatuses(ctx.groups))) {
      return { run: "review_ready", cancelRemaining: false };
    }
    if (readyPlanWork(plan, projected, competeGroupStatuses(ctx.groups)) !== null) {
      return { run: mode === "live" ? "running" : "awaiting_human", cancelRemaining: false };
    }
    // The turn itself succeeded, so the run rests on what the plan's other steps still owe it — the same reading `settleIdleRun` makes on boot.
    return { run: haltedPlanOutcome(plan, projected) ?? "failed", cancelRemaining: true };
  }
  if (classification === "interrupted") return { run: "awaiting_human", cancelRemaining: false };
  if (classification === "canceled") return { run: "canceled", cancelRemaining: true };
  return { run: "failed", cancelRemaining: true };
}

function settleCompeteTurn(
  ctx: SettleContext,
  turnSession: AgentSessionRow,
  turnStep: StepRunRow,
  evidence: SettleEvidence,
): ReconcileOutcome {
  const groupId = turnStep.compete_group_id;
  const group = ctx.groups.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`compete group ${groupId} vanished during settle`);
  if (group.status === "selected") {
    driveTurnConvergence(
      ctx.db,
      ctx.run,
      { step: turnStep, session: turnSession },
      evidence.targets,
      [],
      ctx.options.now,
    );
    return recordTurnOutcome(ctx, turnSession, turnStep.id, evidence, evidence.targets.run);
  }

  const projected = stepStatuses(ctx.steps);
  if (!isStepSettled(turnStep.status)) projected.set(turnStep.id, evidence.targets.step);
  const candidateStates = ctx.steps
    .filter((step) => step.compete_group_id === group.id)
    .map((step) => projected.get(step.id) ?? step.status);
  const hasActive = candidateStates.some((status) => UNSETTLED_CANDIDATE_STATES.has(status));
  const hasSucceeded = candidateStates.includes("succeeded");
  const hasResumable = candidateStates.includes("awaiting_human");
  const targets = competeTargets(hasActive, hasSucceeded, hasResumable);
  const groupTarget = targets.group;
  const runTarget = targets.run;

  ctx.db.transaction(
    () => {
      if (!isStepSettled(turnStep.status)) {
        driveStepTo(ctx.db, turnStep.id, turnStep.status, evidence.targets.step);
      }
      driveSessionTo(ctx.db, turnSession.id, turnSession.status, evidence.targets.session);
      if (groupTarget === "failed") {
        for (const step of ctx.steps) {
          if (step.compete_group_id !== group.id && !isStepSettled(step.status)) {
            driveStepTo(ctx.db, step.id, step.status, "canceled");
          }
        }
      }
      driveCompeteGroupTo(ctx.db, group.id, group.status, groupTarget);
      driveRunTo(ctx.db, ctx.run.id, ctx.run.status, runTarget, ctx.options.now);
    },
    { behavior: "immediate" },
  );

  return recordTurnOutcome(ctx, turnSession, turnStep.id, evidence, runTarget);
}

/** Converges one live-tracked (or still-open) turn without changing a compete sibling. */
export function settleTurn(
  ctx: SettleContext,
  plan: RunPlan,
  turnSession: AgentSessionRow,
  evidence: SettleEvidence,
): ReconcileOutcome {
  const { classification, targets } = evidence;

  const turnStep = ctx.steps.find((step) => step.id === turnSession.step_run_id) ?? null;
  if (turnStep?.compete_group_id) {
    return settleCompeteTurn(ctx, turnSession, turnStep, evidence);
  }

  const projected = stepStatuses(ctx.steps);
  if (turnStep !== null && !isStepSettled(turnStep.status)) {
    projected.set(turnStep.id, targets.step);
  }
  const resolution = resolveRunTarget(ctx, classification, plan, projected, ctx.options.mode);
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

  return recordTurnOutcome(ctx, turnSession, turnStep?.id ?? null, evidence, resolution.run);
}
