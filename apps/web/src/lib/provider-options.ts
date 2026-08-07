import {
  PROVIDER_OPTION_KEYS,
  type ProviderOptionChoice,
  type ProviderOptionDescriptor,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
} from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

/** Select sentinel for "no override": whatever the runtime does on its own applies. */
export const RUNTIME_DEFAULT_OPTION = "__runtime_default";

const RUNTIME_DEFAULT_LABEL = "Runtime default";

/** One option a profile stores, with the value it stores it as. */
export interface StoredProviderOption {
  key: ProviderOptionKey;
  value: string;
}

/** One entry a provider-option picker offers. */
export interface ProviderOptionItem {
  value: string;
  label: string;
  /** A stored value the CLI no longer announces, kept in the list so the trigger never lies about what is saved. */
  stale: boolean;
}

/** What the runtime does with no override, naming the value whenever Otomat is the one that sends it. */
function runtimeDefaultLabel(descriptor: ProviderOptionDescriptor): string {
  return descriptor.default_value === null
    ? RUNTIME_DEFAULT_LABEL
    : `${RUNTIME_DEFAULT_LABEL} — ${providerOptionValueLabel(descriptor.default_value)}`;
}

function choiceLabel(choice: ProviderOptionChoice): string {
  const label = providerOptionValueLabel(choice.value);
  return choice.dangerous ? `${label} — dangerous` : label;
}

/** Every entry the picker offers, in display order: the runtime default, a stored value the CLI dropped, then what it announces. */
export function providerOptionItems(
  descriptor: ProviderOptionDescriptor,
  value: string | null,
): ProviderOptionItem[] {
  const dropped =
    value !== null && !descriptor.choices.some((choice) => choice.value === value)
      ? [{ value, label: `${providerOptionValueLabel(value)} — no longer offered`, stale: true }]
      : [];
  return [
    { value: RUNTIME_DEFAULT_OPTION, label: runtimeDefaultLabel(descriptor), stale: false },
    ...dropped,
    ...descriptor.choices.map((choice) => ({
      value: choice.value,
      label: choiceLabel(choice),
      stale: false,
    })),
  ];
}

/** The value that will actually be sent, and where it came from — this profile, or the runtime's own default. */
export function effectiveProviderOptionLabel(
  descriptor: ProviderOptionDescriptor,
  value: string | null,
): string {
  return value === null ? runtimeDefaultLabel(descriptor) : providerOptionValueLabel(value);
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

export function withProviderOption(
  options: ProviderOptions,
  key: ProviderOptionKey,
  value: string | null,
): ProviderOptions {
  const next = { ...options };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}

/** One honest sentence about where these fields come from, or why there are none. */
export function providerOptionsNote(
  set: ProviderOptionSet | undefined,
  isPending: boolean,
  isError: boolean,
): string | null {
  if (isPending) return "Checking what the installed CLI accepts…";
  if (isError) return "The daemon could not report this runtime's options.";
  if (set === undefined) return null;
  if (set.options.length === 0) return `${set.detection.detail} No option is tunable here.`;
  return set.detection.detail;
}
