import type {
  AgentProfileContract,
  RuntimeDescriptor,
  SaveAgentProfileRequest,
} from "@otomat/domain";
import { isAvailableRuntime, resolveRuntimeChoice, runtimeById } from "@web/lib/runtimes";

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

/** The inverse of {@link agentChoiceToRequest}: the choice a saved plan or preset node encodes. */
export function nodeAgentChoice(node: {
  agent: string | null;
  profile_id?: string | null;
}): string | null {
  if (node.profile_id) return encodeProfileChoice(node.profile_id);
  return node.agent === null ? null : encodeRuntimeChoice(node.agent);
}

/** The saved profile a choice resolves to; null for an ad-hoc runtime, an inherit choice, or a profile that no longer exists. */
export function agentChoiceProfile(
  choice: string | null,
  profiles: AgentProfileContract[],
): AgentProfileContract | null {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null || decoded.kind === "runtime") return null;
  return profiles.find((profile) => profile.id === decoded.id) ?? null;
}

/** The runtime a choice will launch on — a profile's runtime or the ad-hoc runtime itself — so its model catalog can be fetched. */
export function agentChoiceRuntimeId(
  choice: string | null,
  profiles: AgentProfileContract[],
): string | null {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null) return null;
  if (decoded.kind === "runtime") return decoded.id;
  return agentChoiceProfile(choice, profiles)?.runtime ?? null;
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

/** The effective run-level choice: keep the preferred one while usable, else the shared runtime fallback, else null. */
export function resolveAgentChoice(
  preferred: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): string | null {
  if (isUsableAgentChoice(preferred, profiles, descriptors)) return preferred;
  const fallback = resolveRuntimeChoice(descriptors, null);
  return fallback ? encodeRuntimeChoice(fallback) : null;
}

/**
 * An unrelated edit resubmits the profile exactly as stored. Its provider
 * options are the daemon's to accept or refuse against the installed CLI, never
 * this surface's to quietly rewrite; a stale one surfaces as a refusal the user
 * fixes in the profile editor.
 */
export function requestForProfile(
  profile: AgentProfileContract,
  changes: Partial<Pick<SaveAgentProfileRequest, "guidance" | "skill_ids">>,
): SaveAgentProfileRequest {
  return {
    name: profile.name,
    runtime: profile.runtime,
    options: profile.options,
    model: profile.model,
    guidance: profile.guidance,
    skill_ids: profile.skill_ids,
    ...changes,
  };
}
