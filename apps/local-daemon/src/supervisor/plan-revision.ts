import type { ResolvedAgentConfig, RunPlanStep } from "@otomat/domain";

import { buildRuntimeEvent, type RuntimeEvent } from "#runtime";

import { SUPERVISOR_ADAPTER, type PlanRevisionOrigin } from "./types.js";

/**
 * Journals one append-only plan revision into the run's ledger: which step was
 * added, what it waits on, and exactly which agent config was frozen for it. The
 * original plan and every executed step stay in the ledger before it, so a
 * revision can be audited but never made to look like the launch plan.
 */
export function buildPlanRevisedEvent(
  runId: string,
  step: RunPlanStep,
  config: ResolvedAgentConfig,
  origin: PlanRevisionOrigin,
  occurredAt: string,
): RuntimeEvent {
  return buildRuntimeEvent({
    runId,
    kind: "run.plan_revised",
    type: "run.plan_revised",
    source: "otomat",
    adapter: SUPERVISOR_ADAPTER,
    occurredAt,
    stepRunId: step.id,
    payload: {
      origin,
      step_name: step.name,
      depends_on: step.depends_on,
      runtime: config.runtime,
      profile_id: config.profile_id,
      model_id: config.model?.id ?? null,
      config_hash: config.config_hash,
    },
  });
}
