import {
  PROVIDER_OPTION_KEYS,
  type ProviderOptionDescriptor,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
} from "@otomat/domain";
import { runtimeDefaultOptionLabel } from "@web/lib/execution/labels";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

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
  return value === null ? runtimeDefaultOptionLabel(descriptor) : providerOptionValueLabel(value);
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
