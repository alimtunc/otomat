import { randomUUID } from "node:crypto";

import type { Db } from "@otomat/db";
import {
  FAKE_RUNTIME_ID,
  isRunPlanCompeteGroup,
  overrideLevel,
  type ExecutionLevel,
  type ExecutionOverrides,
  type ExecutionSource,
  type ResolvedAgentConfig,
  type RunPlan,
  type RunPlanNodeInput,
  type StartRunRequest,
} from "@otomat/domain";

import { resolveAgentConfig, type AgentConfigOverrides, type AgentConfigSelector } from "#agents";

const STEP_NAME = "Agent turn";

function mappedStepId(idByRequestId: ReadonlyMap<string, string>, requestId: string): string {
  const mapped = idByRequestId.get(requestId);
  if (mapped === undefined) throw new Error(`plan references unknown step id ${requestId}`);
  return mapped;
}

export interface RunDefaultConfig {
  selector: AgentConfigSelector;
  overrides: ExecutionOverrides;
  runtimeSource: Extract<ExecutionSource, "launch" | "global">;
}

export function runDefaultConfig(
  request: StartRunRequest,
  defaultRuntime: string | null,
): RunDefaultConfig {
  const overrides = { model: request.model, options: request.options };
  if (request.profile_id) {
    return {
      selector: { kind: "profile", profileId: request.profile_id },
      overrides,
      runtimeSource: "launch",
    };
  }
  return {
    selector: { kind: "runtime", runtimeId: request.runtime ?? defaultRuntime ?? FAKE_RUNTIME_ID },
    overrides,
    runtimeSource: request.runtime ? "launch" : "global",
  };
}

/** Dropping an empty level lets two nodes that chose the same thing share one resolution. */
function selects(level: ExecutionLevel): boolean {
  return level.model !== undefined || Object.keys(level.options).length > 0;
}

function launchLevels(runDefault: RunDefaultConfig): ExecutionLevel[] {
  return [overrideLevel("launch", runDefault.overrides)].filter(selects);
}

/** One launch level, so the run default and a node read the same hierarchy. */
export function runDefaultOverrides(runDefault: RunDefaultConfig): AgentConfigOverrides {
  return { levels: launchLevels(runDefault), runtimeSource: runDefault.runtimeSource };
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

function modelKey(level: ExecutionLevel): string {
  if (level.model === undefined) return "inherit";
  return level.model.kind === "provider_default" ? "provider_default" : `model:${level.model.id}`;
}

function levelKey(level: ExecutionLevel): string {
  return `${level.source}|${modelKey(level)}|${JSON.stringify(level.options)}`;
}

function configKey(selector: AgentConfigSelector, levels: readonly ExecutionLevel[]): string {
  const source =
    selector.kind === "profile" ? `profile:${selector.profileId}` : `runtime:${selector.runtimeId}`;
  return `${source}|${levels.map(levelKey).join("|")}`;
}

/** A node that keeps the run's agent inherits its model and options too; one that names its own agent starts over. Its own selections come first either way. */
function nodeLevels(
  node: ExecutionOverrides,
  launch: ExecutionOverrides,
  inheritsAgent: boolean,
): ExecutionLevel[] {
  const own = overrideLevel("step", node);
  const levels = inheritsAgent ? [own, overrideLevel("launch", launch)] : [own];
  return levels.filter(selects);
}

type ConfigResolver = (
  selector: AgentConfigSelector | null,
  overrides: ExecutionOverrides,
) => ResolvedAgentConfig;

/** One resolution per distinct agent+levels combination per launch (default included), so nodes sharing a choice freeze the identical snapshot. */
function makeConfigResolver(
  db: Db,
  runDefault: RunDefaultConfig,
  defaultConfig: ResolvedAgentConfig,
): ConfigResolver {
  const defaultKey = configKey(runDefault.selector, launchLevels(runDefault));
  const byKey = new Map([[defaultKey, defaultConfig]]);
  return (selector, overrides) => {
    const effectiveSelector = selector ?? runDefault.selector;
    const levels = nodeLevels(overrides, runDefault.overrides, selector === null);
    const key = configKey(effectiveSelector, levels);
    const cached = byKey.get(key);
    if (cached) return cached;
    const config = resolveAgentConfig(db, effectiveSelector, {
      levels,
      runtimeSource: selector === null ? runDefault.runtimeSource : "step",
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
        const config = configFor(nodeSelector(competitor), competitor);
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
  const config = configFor(nodeSelector(node), node);
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
 * frozen snapshot, never the live profile or the host defaults as they stand later.
 */
export function freezePlan(
  db: Db,
  request: StartRunRequest,
  runDefault: RunDefaultConfig,
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
  const configFor = makeConfigResolver(db, runDefault, defaultConfig);
  return {
    version: 1,
    steps: request.plan.steps.map((node) => freezeNode(node, idByRequestId, configFor)),
  };
}
