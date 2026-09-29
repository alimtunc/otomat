import {
  PROVIDER_OPTION_KEYS,
  type ProviderOptionDescriptor,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
} from "@otomat/domain";
import { runtimeDefaultOptionLabel } from "@web/lib/execution/labels";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

function isEffortKey(key: ProviderOptionKey): boolean {
  return key === "effort" || key === "reasoning_effort";
}

export function effortValue(options: ProviderOptions): string | undefined {
  return options.effort ?? options.reasoning_effort;
}

export function effortDescriptor(
  set: ProviderOptionSet | undefined,
): ProviderOptionDescriptor | undefined {
  return set?.options.find((option) => isEffortKey(option.key));
}

export function offersEffort(set: ProviderOptionSet, effort: string): boolean {
  return effortDescriptor(set)?.choices.some((choice) => choice.value === effort) ?? false;
}

/** Claude and Codex name their effort differently, so a new value replaces whichever key the config carried. */
export function withEffort(
  options: ProviderOptions,
  key: ProviderOptionKey,
  value: string | undefined,
): ProviderOptions {
  const next = { ...options };
  delete next.effort;
  delete next.reasoning_effort;
  if (value !== undefined) next[key] = value;
  return next;
}

/** One option a profile stores, with the value it stores it as. */
export interface StoredProviderOption {
  key: ProviderOptionKey;
  value: string;
}

/** The value that will actually be sent, and where it came from — this profile, or the runtime's own default. */
export function effectiveProviderOptionLabel(
  descriptor: ProviderOptionDescriptor,
  value: string | null,
): string {
  return value === null
    ? runtimeDefaultOptionLabel(descriptor)
    : providerOptionValueLabel(descriptor.key, value);
}

/** What a profile stores, in the fixed key order, so every surface lists the same options the same way. */
export function storedProviderOptions(options: ProviderOptions): StoredProviderOption[] {
  return PROVIDER_OPTION_KEYS.flatMap((key): StoredProviderOption[] => {
    const value = options[key];
    return value === undefined ? [] : [{ key, value }];
  });
}

/** Stored keys this runtime and model offer no field for; surfaced explicitly rather than dropped behind the user's back. */
export function unofferedProviderOptions(
  options: ProviderOptions,
  set: ProviderOptionSet | undefined,
): StoredProviderOption[] {
  if (set === undefined) return [];
  return storedProviderOptions(options).filter(
    (stored) => !set.options.some((option) => option.key === stored.key),
  );
}

export function unsupportedProviderOptions(
  options: ProviderOptions,
  set: ProviderOptionSet,
): StoredProviderOption[] {
  return storedProviderOptions(options).filter(
    (stored) =>
      !set.options.some(
        (option) =>
          option.key === stored.key &&
          option.choices.some((choice) => choice.value === stored.value),
      ),
  );
}
