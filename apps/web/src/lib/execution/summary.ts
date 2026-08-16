import { providerOptionDefault } from "@otomat/domain";
import type {
  ModelSelection,
  ProviderOptionDescriptor,
  ProviderOptionKey,
  ResolvedExecutionValue,
} from "@otomat/domain";
import { resolvedModelLabel, resolvedOptionLabel } from "@web/lib/execution/labels";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";

export interface ResolvedExecutionOption {
  key: ProviderOptionKey;
  descriptor: ProviderOptionDescriptor;
  resolved: ResolvedExecutionValue<string>;
}

const PROVIDER_DEFAULT_SEGMENT = "Provider default";

function modelSegment(model: ResolvedExecutionValue<ModelSelection>): string {
  if (model.value === null || model.value.kind === "provider_default") {
    return PROVIDER_DEFAULT_SEGMENT;
  }
  return model.value.id;
}

/** An option nothing selects falls back to the value the CLI names, and is omitted when it names none rather than inventing one. */
export function executionSummarySegments(
  agentLabel: string,
  model: ResolvedExecutionValue<ModelSelection>,
  options: readonly ResolvedExecutionOption[],
): string[] {
  const optionSegments = options.flatMap((option) => {
    const value = option.resolved.value ?? providerOptionDefault(option.descriptor);
    return value === null ? [] : [providerOptionValueLabel(value)];
  });
  return [agentLabel, modelSegment(model), ...optionSegments];
}

export interface ExecutionSummaryEntry {
  label: string;
  /** The effective value with where it came from, which the compact summary has no room for. */
  value: string;
}

export function executionSummaryDetails(
  agentLabel: string,
  model: ResolvedExecutionValue<ModelSelection>,
  options: readonly ResolvedExecutionOption[],
  profileName: string | null,
): ExecutionSummaryEntry[] {
  return [
    { label: "Agent", value: agentLabel },
    { label: "Model", value: resolvedModelLabel(model, profileName) },
    ...options.map((option) => ({
      label: providerOptionKeyLabel(option.key),
      value: resolvedOptionLabel(option.resolved, option.descriptor, profileName),
    })),
  ];
}
