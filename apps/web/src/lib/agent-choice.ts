import type {
  AgentProfileContract,
  ProviderOptionDescriptor,
  RuntimeDescriptor,
} from "@otomat/domain";

import { isAvailableRuntime, isRealRuntime } from "./runtimes.js";

/** A launch selection encoded as a single string: a saved profile or an ad-hoc runtime. `null` means "inherit the run default" for a per-node selection. */
export const AGENT_CHOICE_DEFAULT = "__default";
const PROFILE_PREFIX = "profile:";
const RUNTIME_PREFIX = "runtime:";

export function encodeProfileChoice(id: string): string {
  return `${PROFILE_PREFIX}${id}`;
}

export function encodeRuntimeChoice(id: string): string {
  return `${RUNTIME_PREFIX}${id}`;
}

/** The request fields a choice contributes to a launch/plan node: a profile id, a runtime id, or neither (inherit). */
export interface AgentRequestFields {
  profile_id?: string;
  runtime?: string;
}

export function agentChoiceToRequest(choice: string | null): AgentRequestFields {
  if (choice === null) return {};
  if (choice.startsWith(PROFILE_PREFIX)) return { profile_id: choice.slice(PROFILE_PREFIX.length) };
  if (choice.startsWith(RUNTIME_PREFIX)) return { runtime: choice.slice(RUNTIME_PREFIX.length) };
  return {};
}

function runtimeAvailable(descriptors: RuntimeDescriptor[], runtimeId: string): boolean {
  const descriptor = descriptors.find((candidate) => candidate.id === runtimeId);
  return descriptor ? isAvailableRuntime(descriptor) : false;
}

/** Whether a choice still resolves to something launchable: an available runtime, or a profile whose runtime is available. */
export function isUsableAgentChoice(
  choice: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): boolean {
  if (choice === null) return false;
  if (choice.startsWith(PROFILE_PREFIX)) {
    const profile = profiles.find(
      (candidate) => candidate.id === choice.slice(PROFILE_PREFIX.length),
    );
    return profile ? runtimeAvailable(descriptors, profile.runtime) : false;
  }
  if (choice.startsWith(RUNTIME_PREFIX)) {
    return runtimeAvailable(descriptors, choice.slice(RUNTIME_PREFIX.length));
  }
  return false;
}

/** The effective run-level choice: keep the preferred one while usable, else the first available real runtime, else null. */
export function resolveAgentChoice(
  preferred: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): string | null {
  if (isUsableAgentChoice(preferred, profiles, descriptors)) return preferred;
  const fallback = descriptors.find(
    (descriptor) => isRealRuntime(descriptor) && isAvailableRuntime(descriptor),
  );
  return fallback ? encodeRuntimeChoice(fallback.id) : null;
}

/** The provider options a runtime honestly supports, for capability-gating a profile form. */
export function runtimeProviderOptions(
  descriptors: RuntimeDescriptor[],
  runtimeId: string | null,
): ProviderOptionDescriptor[] {
  if (runtimeId === null) return [];
  return descriptors.find((descriptor) => descriptor.id === runtimeId)?.provider_options ?? [];
}
