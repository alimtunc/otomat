import { executableSteps, type ResolvedAgentConfig, type RunPlan } from "@otomat/domain";

import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

export function preflightRuntimeConfig(
  runtime: KnownRuntimeId,
  config: ResolvedAgentConfig | null,
  cwd: string,
): void {
  const adapter = createRuntimeAdapter(runtime);
  adapter.preflight?.({
    cwd,
    options: config?.options ?? {},
    model: config?.model?.id ?? null,
  });
}

export function preflightRunPlan(plan: RunPlan, cwd: string): void {
  const seen = new Set<string>();
  for (const step of executableSteps(plan)) {
    if (step.agent === null) continue;
    if (!isKnownRuntimeId(step.agent)) throw new UnknownRuntimeError(step.agent);
    const key = `${step.agent}:${step.config?.config_hash ?? "legacy"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    preflightRuntimeConfig(step.agent, step.config ?? null, cwd);
  }
}
