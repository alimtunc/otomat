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

import {
  nodeAgentSelector,
  resolveAgentConfig,
  type AgentConfigOverrides,
  type AgentConfigSelector,
} from "#agents";
import type { ContextFreezer } from "#context";

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

export interface PlanConfigs {
  configFor: ConfigResolver;
  /** Every runtime the launch will need, so an unavailable one is refused before the repository is touched. */
  runtimes: string[];
}

/** Resolves each node's agent config once. Nothing here reads the repository, so a launch still refuses on its agents first. */
export function resolvePlanConfigs(
  db: Db,
  request: StartRunRequest,
  runDefault: RunDefaultConfig,
  defaultConfig: ResolvedAgentConfig,
): PlanConfigs {
  const configFor = makeConfigResolver(db, runDefault, defaultConfig);
  const executable = (request.plan?.steps ?? []).flatMap((node) =>
    isRunPlanCompeteGroup(node) ? node.compete : [node],
  );
  return {
    configFor,
    runtimes: [
      defaultConfig.runtime,
      ...executable.map((node) => configFor(nodeAgentSelector(node), node).runtime),
    ],
  };
}

function freezeNode(
  node: RunPlanNodeInput,
  idByRequestId: ReadonlyMap<string, string>,
  configFor: ConfigResolver,
  freezeContext: ContextFreezer,
) {
  const dependencies = node.depends_on.map((dependency) => mappedStepId(idByRequestId, dependency));
  if (isRunPlanCompeteGroup(node)) {
    return {
      id: mappedStepId(idByRequestId, node.id),
      name: node.name,
      depends_on: dependencies,
      compete: node.compete.map((competitor) => {
        const config = configFor(nodeAgentSelector(competitor), competitor);
        return {
          id: mappedStepId(idByRequestId, competitor.id),
          name: competitor.name,
          agent: config.runtime,
          prompt: null,
          context: freezeContext(competitor.context ?? [], competitor.note ?? null),
          config,
        };
      }),
    };
  }
  const config = configFor(nodeAgentSelector(node), node);
  return {
    id: mappedStepId(idByRequestId, node.id),
    name: node.name,
    agent: config.runtime,
    prompt: null,
    context: freezeContext(node.context ?? [], node.note ?? null),
    depends_on: dependencies,
    config,
  };
}

/**
 * Freezes the launch plan: request-local ids become the generated `step_runs` ids (plan step id ==
 * step_run id), and each node's resolved agent config and declared context are embedded so
 * resume/follow-up/fix read the frozen snapshot, never the live profile, the host defaults or the
 * tracker as they stand later. A node's name stays a label: nothing composes it into an instruction.
 */
export function freezePlan(
  request: StartRunRequest,
  defaultConfig: ResolvedAgentConfig,
  configFor: ConfigResolver,
  freezeContext: ContextFreezer,
): RunPlan {
  if (!request.plan) {
    return {
      version: 1,
      steps: [
        {
          id: randomUUID(),
          name: STEP_NAME,
          agent: defaultConfig.runtime,
          prompt: null,
          context: freezeContext(request.context ?? [], request.note ?? null),
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
  return {
    version: 1,
    steps: request.plan.steps.map((node) =>
      freezeNode(node, idByRequestId, configFor, freezeContext),
    ),
  };
}
