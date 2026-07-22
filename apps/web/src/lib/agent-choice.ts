import {
  CLAUDE_PERMISSION_MODES,
  type AgentProfileContract,
  type ClaudePermissionMode,
  type ProviderOptionDescriptor,
  type RuntimeDescriptor,
  type SaveAgentProfileRequest,
} from "@otomat/domain";
import { isAvailableRuntime, resolveRuntimeChoice, runtimeById } from "@web/lib/runtimes";

// A launch selection is encoded as a single string: a saved profile or an ad-hoc runtime; `null` means "inherit the run default" for a per-node selection.
const PROFILE_PREFIX = "profile:";
const RUNTIME_PREFIX = "runtime:";

/** Select sentinel that maps to the `null` (inherit) choice. */
export const AGENT_CHOICE_DEFAULT = "__default";

export function encodeProfileChoice(id: string): string {
  return `${PROFILE_PREFIX}${id}`;
}

export function encodeRuntimeChoice(id: string): string {
  return `${RUNTIME_PREFIX}${id}`;
}

function decodeAgentChoice(
  choice: string | null,
): { kind: "profile" | "runtime"; id: string } | null {
  if (choice?.startsWith(PROFILE_PREFIX)) {
    return { kind: "profile", id: choice.slice(PROFILE_PREFIX.length) };
  }
  if (choice?.startsWith(RUNTIME_PREFIX)) {
    return { kind: "runtime", id: choice.slice(RUNTIME_PREFIX.length) };
  }
  return null;
}

/** The request fields a choice contributes to a launch/plan node: a profile id, a runtime id, or neither (inherit). */
export interface AgentRequestFields {
  profile_id?: string;
  runtime?: string;
}

export function agentChoiceToRequest(choice: string | null): AgentRequestFields {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null) return {};
  return decoded.kind === "profile" ? { profile_id: decoded.id } : { runtime: decoded.id };
}

function runtimeAvailable(descriptors: RuntimeDescriptor[], runtimeId: string): boolean {
  const descriptor = runtimeById(descriptors, runtimeId);
  return descriptor ? isAvailableRuntime(descriptor) : false;
}

/** Whether a choice still resolves to something launchable: an available runtime, or a profile whose runtime is available. */
export function isUsableAgentChoice(
  choice: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): boolean {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null) return false;
  if (decoded.kind === "profile") {
    const profile = profiles.find((candidate) => candidate.id === decoded.id);
    return profile ? runtimeAvailable(descriptors, profile.runtime) : false;
  }
  return runtimeAvailable(descriptors, decoded.id);
}

/** The effective run-level choice: keep the preferred one while usable, else the shared runtime fallback (never auto-select simulated), else null. */
export function resolveAgentChoice(
  preferred: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): string | null {
  if (isUsableAgentChoice(preferred, profiles, descriptors)) return preferred;
  const fallback = resolveRuntimeChoice(descriptors, null);
  return fallback ? encodeRuntimeChoice(fallback) : null;
}

/** The provider options a runtime honestly supports, for capability-gating a profile form. */
export function runtimeProviderOptions(
  descriptors: RuntimeDescriptor[],
  runtimeId: string | null,
): ProviderOptionDescriptor[] {
  if (runtimeId === null) return [];
  return runtimeById(descriptors, runtimeId)?.provider_options ?? [];
}

export function permissionModeOption(
  providerOptions: ProviderOptionDescriptor[] | undefined,
): ProviderOptionDescriptor | undefined {
  return providerOptions?.find((option) => option.key === "permission_mode");
}

/** The display label for a selected option value; falls back to the raw value when the descriptor no longer lists it. */
function providerOptionChoiceLabel(option: ProviderOptionDescriptor, value: string): string {
  return option.choices.find((choice) => choice.value === value)?.label ?? value;
}

export type PermissionModeValue = ClaudePermissionMode | "";

function isClaudePermissionMode(value: string): value is ClaudePermissionMode {
  return CLAUDE_PERMISSION_MODES.some((mode) => mode === value);
}

/** The stored value while the chosen runtime's descriptor still advertises it; "" (runtime default) otherwise. */
export function supportedPermissionMode(
  descriptors: RuntimeDescriptor[],
  runtime: string,
  value: string | undefined,
): PermissionModeValue {
  if (!value || !isClaudePermissionMode(value)) return "";
  const permissionOption = permissionModeOption(runtimeProviderOptions(descriptors, runtime));
  return permissionOption?.choices.some((choice) => choice.value === value) ? value : "";
}

/** The label of the profile's stored permission mode, or null when none is stored or the runtime no longer advertises the option. */
export function storedPermissionModeLabel(
  profile: AgentProfileContract,
  descriptor: RuntimeDescriptor | undefined,
): string | null {
  const value = profile.options.permission_mode;
  if (!value) return null;
  const option = permissionModeOption(descriptor?.provider_options);
  if (!option) return null;
  return providerOptionChoiceLabel(option, value);
}

/** A stored permission_mode the descriptor no longer advertises is dropped so the daemon's option gate accepts the unrelated edit. */
export function requestForProfile(
  profile: AgentProfileContract,
  descriptor: RuntimeDescriptor | undefined,
  changes: Partial<Pick<SaveAgentProfileRequest, "guidance" | "skill_ids">>,
): SaveAgentProfileRequest {
  const permissionMode = profile.options.permission_mode;
  const option = permissionModeOption(descriptor?.provider_options);
  const supportsPermissionMode = option?.choices.some((choice) => choice.value === permissionMode);

  return {
    name: profile.name,
    runtime: profile.runtime,
    options: supportsPermissionMode ? { permission_mode: permissionMode } : {},
    guidance: profile.guidance,
    skill_ids: profile.skill_ids,
    ...changes,
  };
}
