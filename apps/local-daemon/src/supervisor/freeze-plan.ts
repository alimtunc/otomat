import { randomUUID } from "node:crypto";

import type { Db } from "@otomat/db";
import {
  FAKE_RUNTIME_ID,
  isRunPlanCompeteGroup,
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

function selectorKey(selector: AgentConfigSelector): string {
  return selector.kind === "profile"
    ? `profile:${selector.profileId}`
    : `runtime:${selector.runtimeId}`;
}

/** One resolution per distinct selector per launch (default included), so nodes sharing a profile freeze the identical snapshot. */
function makeConfigResolver(db: Db, request: StartRunRequest, defaultConfig: ResolvedAgentConfig) {
  const bySelector = new Map([[selectorKey(defaultConfigSelector(request)), defaultConfig]]);
  return (selector: AgentConfigSelector | null): ResolvedAgentConfig => {
    if (selector === null) return defaultConfig;
    const key = selectorKey(selector);
    const cached = bySelector.get(key);
    if (cached) return cached;
    const config = resolveAgentConfig(db, selector);
    bySelector.set(key, config);
    return config;
  };
}

function freezeNode(
  node: RunPlanNodeInput,
  idByRequestId: ReadonlyMap<string, string>,
  configFor: (selector: AgentConfigSelector | null) => ResolvedAgentConfig,
) {
  const dependencies = node.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency));
  // `in` narrowing, not isRunPlanCompeteGroup: the guard cannot exclude the compete *input* member on the else branch.
  if ("compete" in node) {
    return {
      id: mappedStepId(idByRequestId, node.id),
      name: node.name,
      depends_on: dependencies,
      compete: node.compete.map((competitor) => {
        const config = configFor(nodeSelector(competitor));
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
  const config = configFor(nodeSelector(node));
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
