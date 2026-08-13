import type { ExecutionSource } from "../contracts/execution-config.js";
import { PROVIDER_OPTION_KEYS, type ProviderOptionKey } from "../contracts/provider-options.js";
import type { ModelSelection } from "../contracts/runtime-model.js";
import type { ExecutionLevel } from "./levels.js";

export interface ResolvedExecutionValue<T> {
  /** Null when no level selected anything, so no argument is sent at all. */
  value: T | null;
  source: ExecutionSource;
}

export function resolveExecutionModel(
  levels: readonly ExecutionLevel[],
): ResolvedExecutionValue<ModelSelection> {
  for (const level of levels) {
    if (level.model !== undefined) return { value: level.model, source: level.source };
  }
  return { value: null, source: "provider" };
}

/** `agent_default` drops the remaining overrides and hands the answer to the agent's own levels. */
export function resolveExecutionOption(
  levels: readonly ExecutionLevel[],
  key: ProviderOptionKey,
): ResolvedExecutionValue<string> {
  let deferred = false;
  for (const level of levels) {
    if (deferred && !level.agent) continue;
    const selection = level.options[key];
    if (selection === undefined) continue;
    if (selection.kind === "agent_default") {
      deferred = true;
      continue;
    }
    return { value: selection.value, source: level.source };
  }
  return { value: null, source: "provider" };
}

export function selectedOptionKeys(levels: readonly ExecutionLevel[]): ProviderOptionKey[] {
  return PROVIDER_OPTION_KEYS.filter((key) =>
    levels.some((level) => level.options[key] !== undefined),
  );
}
