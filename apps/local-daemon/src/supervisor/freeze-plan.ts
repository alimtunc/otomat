import { randomUUID } from "node:crypto";

import {
  isRunPlanCompeteGroup,
  type RunPlan,
  type RunPlanNodeInput,
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
): ReadonlyMap<string, KnownRuntimeId> | null {
  if (!request.plan) return null;
  const runtimes = new Map<string, KnownRuntimeId>();
  for (const node of request.plan.steps) {
    const steps = isRunPlanCompeteGroup(node) ? node.compete : [node];
    for (const step of steps) {
      runtimes.set(
        step.id,
        step.agent === null ? defaultRuntime : requireAvailableRuntime(step.agent),
      );
    }
  }
  return runtimes;
}

function freezeNode(
  node: RunPlanNodeInput,
  idByRequestId: ReadonlyMap<string, string>,
  runtimes: ReadonlyMap<string, KnownRuntimeId>,
) {
  const dependencies = node.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency));
  if (isRunPlanCompeteGroup(node)) {
    return {
      id: mappedStepId(idByRequestId, node.id),
      name: node.name,
      depends_on: dependencies,
      compete: node.compete.map((competitor) => ({
        id: mappedStepId(idByRequestId, competitor.id),
        name: competitor.name,
        agent: runtimes.get(competitor.id) ?? null,
        prompt: `Shared objective:\n${node.name}\n\nCandidate instructions:\n${competitor.prompt}`,
      })),
    };
  }
  return {
    id: mappedStepId(idByRequestId, node.id),
    name: node.name,
    agent: runtimes.get(node.id) ?? null,
    prompt: node.prompt,
    depends_on: dependencies,
  };
}

/** Freezes the launch plan: request-local ids become the generated `step_runs` ids (plan step id == step_run id) and per-step `agent` lands resolved, never null. */
export function freezePlan(
  request: StartRunRequest,
  defaultRuntime: KnownRuntimeId,
  stepRuntimes: ReadonlyMap<string, KnownRuntimeId> | null,
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

  const idByRequestId = new Map<string, string>();
  for (const node of request.plan.steps) {
    idByRequestId.set(node.id, randomUUID());
    if (isRunPlanCompeteGroup(node)) {
      for (const competitor of node.compete) idByRequestId.set(competitor.id, randomUUID());
    }
  }
  return {
    version: 1,
    steps: request.plan.steps.map((node) => freezeNode(node, idByRequestId, stepRuntimes)),
  };
}
