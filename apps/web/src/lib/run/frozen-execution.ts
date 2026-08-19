import {
  isRunPlanCompeteGroup,
  PROVIDER_OPTION_KEYS,
  type ExecutionSource,
  type ProviderOptionKey,
  type ResolvedAgentConfig,
  type RunPlan,
} from "@otomat/domain";
import { frozenModelLabel } from "@web/lib/model-choice";

export interface FrozenExecutionValue {
  label: string;
  source: string | null;
}

export interface FrozenExecution {
  /** The plan node this was frozen for; a step run carries the same id. */
  id: string;
  /** How the step reads in the plan; a competitor is named under its group. */
  name: string;
  /** Identical configurations share it, so "several configurations" counts intent, not nodes. */
  configHash: string;
  runtime: FrozenExecutionValue;
  model: FrozenExecutionValue;
  options: (FrozenExecutionValue & { key: ProviderOptionKey })[];
}

const SOURCE_LABELS = {
  step: "set on this step",
  launch: "chosen at launch",
  profile: "from the agent profile",
  global: "from the global defaults",
  provider: "runtime default",
} satisfies Record<ExecutionSource, string>;

function value(label: string, source: ExecutionSource | undefined): FrozenExecutionValue {
  return { label, source: source === undefined ? null : SOURCE_LABELS[source] };
}

function describe(id: string, name: string, config: ResolvedAgentConfig): FrozenExecution {
  const sources = config.sources;
  return {
    id,
    name,
    configHash: config.config_hash,
    runtime: value(config.profile_name ?? config.runtime, sources?.runtime),
    model: value(frozenModelLabel(config.model ?? null), sources?.model),
    options: PROVIDER_OPTION_KEYS.flatMap((key) => {
      const selected = config.options[key];
      return selected === undefined ? [] : [{ key, ...value(selected, sources?.options[key]) }];
    }),
  };
}

/** One entry per plan node that froze a configuration, in plan order; a node without one is left out rather than guessed. */
export function frozenRunExecutions(plan: RunPlan): FrozenExecution[] {
  return plan.steps.flatMap((node) => {
    if (!isRunPlanCompeteGroup(node)) {
      return node.config ? [describe(node.id, node.name, node.config)] : [];
    }
    return node.compete.flatMap((competitor) =>
      competitor.config
        ? [describe(competitor.id, `${node.name} · ${competitor.name}`, competitor.config)]
        : [],
    );
  });
}
