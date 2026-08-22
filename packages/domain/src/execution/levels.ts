import type {
  ExecutionDefaults,
  ExecutionOptionSelections,
  ExecutionSource,
} from "../contracts/execution-config.js";
import { PROVIDER_OPTION_KEYS, type ProviderOptions } from "../contracts/provider-options.js";
import type { ModelSelection } from "../contracts/runtime-model.js";

export interface ExecutionLevel {
  source: Exclude<ExecutionSource, "provider">;
  /** Marks the levels an `agent_default` selection defers to: the profile and the host defaults. */
  agent: boolean;
  model?: ModelSelection;
  options: ExecutionOptionSelections;
}

export interface ExecutionOverrides {
  model?: ModelSelection;
  options?: ExecutionOptionSelections;
}

export interface StoredExecutionConfig {
  model: string | null;
  options: ProviderOptions;
}

export function optionSelectionsFromValues(options: ProviderOptions): ExecutionOptionSelections {
  const selections: ExecutionOptionSelections = {};
  for (const key of PROVIDER_OPTION_KEYS) {
    const value = options[key];
    if (value !== undefined) selections[key] = { kind: "value", value };
  }
  return selections;
}

export function overrideLevel(
  source: Extract<ExecutionSource, "turn" | "step" | "launch">,
  overrides: ExecutionOverrides,
): ExecutionLevel {
  const level: ExecutionLevel = { source, agent: false, options: overrides.options ?? {} };
  if (overrides.model !== undefined) level.model = overrides.model;
  return level;
}

/** A stored model of `null` selects nothing rather than the provider default: only an override can ask for "send no model". */
export function storedLevel(
  source: Extract<ExecutionSource, "profile" | "global">,
  stored: StoredExecutionConfig,
): ExecutionLevel {
  const level: ExecutionLevel = {
    source,
    agent: true,
    options: optionSelectionsFromValues(stored.options),
  };
  if (stored.model !== null) level.model = { kind: "model", id: stored.model };
  return level;
}

/** Null when the defaults name another runtime: their model and option keys belong to the CLI that announced them. */
export function globalLevel(defaults: ExecutionDefaults, runtime: string): ExecutionLevel | null {
  return defaults.runtime === runtime ? storedLevel("global", defaults) : null;
}

export function executionLevels(
  overrides: readonly ExecutionLevel[],
  profile: StoredExecutionConfig | null,
  defaults: ExecutionDefaults,
  runtime: string,
): ExecutionLevel[] {
  const agentLevels = [
    profile === null ? null : storedLevel("profile", profile),
    globalLevel(defaults, runtime),
  ];
  return [...overrides, ...agentLevels.filter((level): level is ExecutionLevel => level !== null)];
}
