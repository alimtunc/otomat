import { randomUUID } from "node:crypto";

import type { Db } from "@otomat/db";
import {
  FAKE_RUNTIME_ID,
  isRunPlanCompeteGroup,
  type EffortSelection,
  type ModelSelection,
  type ResolvedAgentConfig,
  type RunPlan,
  type RunPlanNodeInput,
  type StartRunRequest,
} from "@otomat/domain";

import { resolveAgentConfig, type AgentConfigSelector } from "#agents";

const STEP_NAME = "Agent turn";

function mappedStepId(idByRequestId: ReadonlyMap<string, string>, requestId: string): string {
  const mapped = idByRequestId.get(requestId);
  if (mapped === undefined) throw new Error(`plan references unknown step id ${requestId}`);
  return mapped;
}

/** The run default agent config: the selected profile, or an ad-hoc runtime. */
export function defaultConfigSelector(request: StartRunRequest): AgentConfigSelector {
  return request.profile_id
    ? { kind: "profile", profileId: request.profile_id }
    : { kind: "runtime", runtimeId: request.runtime ?? FAKE_RUNTIME_ID };
}

/** A per-node selector: its own profile, its own ad-hoc runtime, or `null` to inherit the run default. */
function nodeSelector(node: {
  agent: string | null;
  profile_id?: string | null;
}): AgentConfigSelector | null {
  if (node.profile_id) return { kind: "profile", profileId: node.profile_id };
  if (node.agent) return { kind: "runtime", runtimeId: node.agent };
  return null;
}

function modelKey(model: ModelSelection | undefined): string {
  if (model === undefined) return "inherit";
  return model.kind === "provider_default" ? "provider_default" : `model:${model.id}`;
}

function configKey(
  selector: AgentConfigSelector,
  model: ModelSelection | undefined,
  effort: string | undefined,
): string {
  const source =
    selector.kind === "profile" ? `profile:${selector.profileId}` : `runtime:${selector.runtimeId}`;
  return `${source}|${modelKey(model)}|${effort === undefined ? "agent" : `level:${effort}`}`;
}

/**
 * The level one node really runs at: its own when it names one, the launch-level
 * one when it inherits, and none — the resolved agent's own — when it asks for
 * the agent default. Unlike the model, an inheriting node takes the launch
 * effort even with its own agent: the plan says "same as run" explicitly.
 */
function effortLevel(
  node: EffortSelection | undefined,
  launch: string | undefined,
): string | undefined {
  if (node === undefined) return launch;
  return node.kind === "level" ? node.value : undefined;
}

/** The effective config of one node: its own agent, model and effort, each falling back to the run default. */
type ConfigResolver = (
  selector: AgentConfigSelector | null,
  model: ModelSelection | undefined,
  effort: EffortSelection | undefined,
) => ResolvedAgentConfig;

/** One resolution per distinct agent+model+effort triple per launch (default included), so nodes sharing a choice freeze the identical snapshot. */
function makeConfigResolver(
  db: Db,
  request: StartRunRequest,
  defaultConfig: ResolvedAgentConfig,
): ConfigResolver {
  const defaultSelector = defaultConfigSelector(request);
  const byKey = new Map([
    [configKey(defaultSelector, request.model, request.effort), defaultConfig],
  ]);
  return (selector, model, effort) => {
    const effectiveSelector = selector ?? defaultSelector;
    const effectiveModel = model ?? (selector === null ? request.model : undefined);
    const effectiveEffort = effortLevel(effort, request.effort);
    const key = configKey(effectiveSelector, effectiveModel, effectiveEffort);
    const cached = byKey.get(key);
    if (cached) return cached;
    const config = resolveAgentConfig(db, effectiveSelector, {
      model: effectiveModel,
      effort: effectiveEffort,
    });
    byKey.set(key, config);
    return config;
  };
}

function freezeNode(
  node: RunPlanNodeInput,
  idByRequestId: ReadonlyMap<string, string>,
  configFor: ConfigResolver,
) {
  const dependencies = node.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency));
  // `in` narrowing, not isRunPlanCompeteGroup: the guard cannot exclude the compete *input* member on the else branch.
  if ("compete" in node) {
    return {
      id: mappedStepId(idByRequestId, node.id),
      name: node.name,
      depends_on: dependencies,
      compete: node.compete.map((competitor) => {
        const config = configFor(nodeSelector(competitor), competitor.model, competitor.effort);
        return {
          id: mappedStepId(idByRequestId, competitor.id),
          name: competitor.name,
          agent: config.runtime,
          prompt: `Shared objective:\n${node.name}\n\nCandidate instructions:\n${competitor.prompt}`,
          config,
        };
      }),
    };
  }
  const config = configFor(nodeSelector(node), node.model, node.effort);
  return {
    id: mappedStepId(idByRequestId, node.id),
    name: node.name,
    agent: config.runtime,
    prompt: node.prompt,
    depends_on: dependencies,
    config,
  };
}

/**
 * Freezes the launch plan: request-local ids become the generated `step_runs` ids (plan step id ==
 * step_run id), and each node's resolved agent config is embedded so resume/follow-up/fix read the
 * frozen snapshot, never the live profile.
 */
export function freezePlan(
  db: Db,
  request: StartRunRequest,
  defaultConfig: ResolvedAgentConfig,
  fallbackPrompt: string,
): RunPlan {
  if (!request.plan) {
    return {
      version: 1,
      steps: [
        {
          id: randomUUID(),
          name: STEP_NAME,
          agent: defaultConfig.runtime,
          prompt: fallbackPrompt,
          depends_on: [],
          config: defaultConfig,
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
  const configFor = makeConfigResolver(db, request, defaultConfig);
  return {
    version: 1,
    steps: request.plan.steps.map((node) => freezeNode(node, idByRequestId, configFor)),
  };
}
