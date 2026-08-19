import {
  PROVIDER_OPTION_KEYS,
  providerOptionDefault,
  providerOptionDescriptor,
  resolveExecutionOption,
  selectedOptionKeys,
  type ExecutionLevel,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
  type ResolvedExecutionSources,
  type ResolvedModel,
} from "@otomat/domain";

import { describeProviderOptions, type KnownRuntimeId } from "#runtime";

import { ProfileOptionUnsupportedError } from "./errors.js";

export interface ResolvedProviderOptions {
  options: ProviderOptions;
  sources: ResolvedExecutionSources["options"];
}

/** A `failed` probe is ignorance, not an answer, and must not turn a working profile into a refused one. */
function announced(support: ProviderOptionSet, key: ProviderOptionKey, value: string): boolean {
  if (support.detection.status === "failed") return true;
  const descriptor = providerOptionDescriptor(support.options, key);
  return descriptor !== null && descriptor.choices.some((choice) => choice.value === value);
}

function refusal(
  runtime: KnownRuntimeId,
  support: ProviderOptionSet,
  key: ProviderOptionKey,
  value: string,
): ProfileOptionUnsupportedError {
  const descriptor = providerOptionDescriptor(support.options, key);
  if (descriptor === null) {
    return new ProfileOptionUnsupportedError(
      `runtime "${runtime}" does not offer the "${key}" option here: ${support.detection.detail}`,
    );
  }
  return new ProfileOptionUnsupportedError(
    `runtime "${runtime}" does not accept requested "${key}" value "${value}"; pick one of ${descriptor.choices.map((choice) => choice.value).join(", ")}. ${support.detection.detail}`,
  );
}

export function assertOptionsAnnounced(
  runtime: KnownRuntimeId,
  model: ResolvedModel | null,
  options: ProviderOptions,
): void {
  const keys = PROVIDER_OPTION_KEYS.filter((key) => options[key] !== undefined);
  if (keys.length === 0) return;
  const support = describeProviderOptions(runtime, model?.id ?? null);
  for (const key of keys) {
    const value = options[key];
    if (value !== undefined && !announced(support, key, value)) {
      throw refusal(runtime, support, key, value);
    }
  }
}

/** An unannounced value is refused, except from the host defaults: those are a preference for every execution rather than a claim about this one, so they are dropped instead. */
export function resolveOptions(
  runtime: KnownRuntimeId,
  model: ResolvedModel | null,
  levels: readonly ExecutionLevel[],
): ResolvedProviderOptions {
  const support = describeProviderOptions(runtime, model?.id ?? null);
  const options: ProviderOptions = {};
  const sources: ResolvedExecutionSources["options"] = {};
  for (const descriptor of support.options) {
    const fallback = providerOptionDefault(descriptor);
    if (fallback === null) continue;
    options[descriptor.key] = fallback;
    sources[descriptor.key] = "provider";
  }
  for (const key of selectedOptionKeys(levels)) {
    const resolved = resolveExecutionOption(levels, key);
    if (resolved.value === null) continue;
    if (!announced(support, key, resolved.value)) {
      if (resolved.source === "global") continue;
      throw refusal(runtime, support, key, resolved.value);
    }
    options[key] = resolved.value;
    sources[key] = resolved.source;
  }
  return { options, sources };
}
