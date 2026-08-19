import type { RunRow } from "@otomat/db";
import {
  executableSteps,
  type ResolvedAgentConfig,
  type RunPlan,
  type RunPlanCompetitor,
  type RunPlanStep,
} from "@otomat/domain";

import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

import type { ResumeAction } from "./resume-plan.js";
import { requireResumableRuntime, RunNotResumableError } from "./resume.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";

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

function preflightStep(
  state: SupervisorState,
  step: RunPlanStep | RunPlanCompetitor,
  worktreePath: string,
): void {
  if (step.agent === null) {
    throw new RunNotResumableError(`step ${step.id} has no runtime to resume`);
  }
  const runtime = ensureRuntimeAgent(state.db, step.agent);
  preflightRuntimeConfig(runtime, step.config ?? null, worktreePath);
}

export function preflightResumeAction(
  state: SupervisorState,
  run: RunRow,
  action: Exclude<ResumeAction, { kind: "unavailable" }>,
): void {
  if (action.kind === "compete_group") {
    const service = state.repositories.forRepository(run.repository_id)?.service;
    if (!service) return;
    for (const competitor of action.competitors) {
      const path = service.get(competitor.id)?.path;
      if (!path) return;
      preflightStep(state, competitor, path);
    }
    return;
  }

  const worktreePath = state.repositories
    .forRepository(run.repository_id)
    ?.service.get(run.id)?.path;
  if (worktreePath === undefined) return;
  if (action.kind === "native") {
    const runtime = requireResumableRuntime(state.db, run, action.session);
    preflightRuntimeConfig(runtime, action.step.config ?? null, worktreePath);
    return;
  }
  if (action.kind === "recovery") {
    preflightStep(state, action.step, worktreePath);
    return;
  }
  const steps = action.work.kind === "step" ? [action.work.step] : action.work.competitors;
  for (const step of steps) preflightStep(state, step, worktreePath);
}
