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
  key: string;
  runtime: FrozenExecutionValue;
  model: FrozenExecutionValue;
  options: (FrozenExecutionValue & { key: ProviderOptionKey })[];
}

const SOURCE_LABELS: Record<ExecutionSource, string> = {
  step: "set on this step",
  launch: "chosen at launch",
  profile: "from the agent profile",
  global: "from the global defaults",
  provider: "runtime default",
};

function value(label: string, source: ExecutionSource | undefined): FrozenExecutionValue {
  return { label, source: source === undefined ? null : SOURCE_LABELS[source] };
}

function describe(config: ResolvedAgentConfig): FrozenExecution {
  const sources = config.sources;
  return {
    key: config.config_hash,
    runtime: value(config.profile_name ?? config.runtime, sources?.runtime),
    model: value(frozenModelLabel(config.model ?? null), sources?.model),
    options: PROVIDER_OPTION_KEYS.flatMap((key) => {
      const selected = config.options[key];
      return selected === undefined ? [] : [{ key, ...value(selected, sources?.options[key]) }];
    }),
  };
}

export function frozenRunExecutions(plan: RunPlan): FrozenExecution[] {
  const configs = plan.steps.flatMap((node) =>
    isRunPlanCompeteGroup(node)
      ? node.compete.map((competitor) => competitor.config)
      : [node.config],
  );
  const byHash = new Map<string, FrozenExecution>();
  for (const config of configs) {
    if (config && !byHash.has(config.config_hash)) {
      byHash.set(config.config_hash, describe(config));
    }
  }
  return [...byHash.values()];
}
