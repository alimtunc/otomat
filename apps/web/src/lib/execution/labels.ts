import { providerOptionDefault } from "@otomat/domain";
import type {
  ExecutionSource,
  ModelSelection,
  ProviderOptionDescriptor,
  ResolvedAgentConfig,
  ResolvedExecutionValue,
} from "@otomat/domain";
import { providerOptionValueLabel } from "@web/lib/provider-option-labels";

export function executionSourceLabel(source: ExecutionSource, profileName: string | null): string {
  switch (source) {
    case "turn":
      return "set for the next turn";
    case "step":
      return "set on this step";
    case "launch":
      return "from the run";
    case "profile":
      return profileName === null ? "from the agent" : `from “${profileName}”`;
    case "global":
      return "from the global defaults";
    case "provider":
      return "runtime default";
  }
}

export function runtimeDefaultOptionLabel(descriptor: ProviderOptionDescriptor): string {
  const named = providerOptionDefault(descriptor);
  if (named === null) return "Runtime default";
  return `Runtime default — ${providerOptionValueLabel(descriptor.key, named)}`;
}

export function resolvedOptionLabel(
  resolved: ResolvedExecutionValue<string>,
  descriptor: ProviderOptionDescriptor,
  profileName: string | null,
): string {
  if (resolved.value === null) return runtimeDefaultOptionLabel(descriptor);
  const value = providerOptionValueLabel(descriptor.key, resolved.value);
  return `${value} — ${executionSourceLabel(resolved.source, profileName)}`;
}

/** Spelled out on the entry itself: "default" alone reads as "some default", not "Otomat stays out of it". */
export const PROVIDER_DEFAULT_MODEL_LABEL = "Provider's own default — Otomat sends no model";

export function resolvedModelLabel(
  resolved: ResolvedExecutionValue<ModelSelection>,
  profileName: string | null,
): string {
  if (resolved.value === null) return PROVIDER_DEFAULT_MODEL_LABEL;
  const source = executionSourceLabel(resolved.source, profileName);
  if (resolved.value.kind === "provider_default") {
    return `Provider's own default — ${source}`;
  }
  return `${resolved.value.id} — ${source}`;
}

export function agentLabel(config: ResolvedAgentConfig): string {
  return config.profile_name ?? "Ad-hoc agent";
}

export function modelLabel(model: ResolvedAgentConfig["model"]): string {
  return model?.id ?? "Provider default";
}

export function participantLabel(config: ResolvedAgentConfig): string {
  return `${agentLabel(config)} · ${config.runtime} · ${modelLabel(config.model)}`;
}
