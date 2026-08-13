import { providerOptionDefault } from "@otomat/domain";
import type {
  ModelSelection,
  ProviderOptionDescriptor,
  ProviderOptionKey,
  ResolvedExecutionValue,
} from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

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
