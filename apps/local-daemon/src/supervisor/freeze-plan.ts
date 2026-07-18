import { randomUUID } from "node:crypto";

import {
  nextReadyStep,
  type RunPlan,
  type RunPlanStep,
  type StartRunRequest,
} from "@otomat/domain";

import type { KnownRuntimeId } from "#runtime";

import { requireAvailableRuntime } from "./runtime-selection.js";

const STEP_NAME = "Agent turn";

function mappedStepId(idByRequestId: ReadonlyMap<string, string>, requestId: string): string {
  const mapped = idByRequestId.get(requestId);
  if (mapped === undefined) throw new Error(`plan references unknown step id ${requestId}`);
  return mapped;
}

/** Effective runtime per plan step (`null` inherits the run default), validated without writing. */
export function resolveStepRuntimes(
  request: StartRunRequest,
  defaultRuntime: KnownRuntimeId,
): KnownRuntimeId[] | null {
  if (!request.plan) return null;
  return request.plan.steps.map((step) =>
    step.agent === null ? defaultRuntime : requireAvailableRuntime(step.agent),
  );
}

/** Freezes the launch plan: request-local ids become the generated `step_runs` ids (plan step id == step_run id) and per-step `agent` lands resolved, never null. */
export function freezePlan(
  request: StartRunRequest,
  defaultRuntime: KnownRuntimeId,
  stepRuntimes: KnownRuntimeId[] | null,
  fallbackPrompt: string,
): RunPlan {
  if (!request.plan || stepRuntimes === null) {
    return {
      version: 1,
      steps: [
        {
          id: randomUUID(),
          name: STEP_NAME,
          agent: defaultRuntime,
          prompt: fallbackPrompt,
          depends_on: [],
        },
      ],
    };
  }

  const idByRequestId = new Map<string, string>(
    request.plan.steps.map((step) => [step.id, randomUUID()]),
  );
  return {
    version: 1,
    steps: request.plan.steps.map((step, index) => ({
      id: mappedStepId(idByRequestId, step.id),
      name: step.name,
      agent: stepRuntimes[index] ?? defaultRuntime,
      prompt: step.prompt,
      depends_on: step.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency)),
    })),
  };
}

export function firstStepToRun(plan: RunPlan): RunPlanStep {
  const first = nextReadyStep(plan, new Map());
  if (first === null) throw new Error("run plan has no startable step");
  return first;
}
