import type {
  AgentProfileContract,
  RuntimeDescriptor,
  SaveAgentProfileRequest,
} from "@otomat/domain";
import { isAvailableRuntime, resolveRuntimeChoice, runtimeById } from "@web/lib/runtimes";

const PROFILE_PREFIX = "profile:";
const RUNTIME_PREFIX = "runtime:";

/** Select sentinel for the `null` (inherit) choice. */
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

export interface AgentRequestFields {
  profile_id?: string;
  runtime?: string;
}

export function agentChoiceToRequest(choice: string | null): AgentRequestFields {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null) return {};
  return decoded.kind === "profile" ? { profile_id: decoded.id } : { runtime: decoded.id };
}

export function nodeAgentChoice(node: {
  agent: string | null;
  profile_id?: string | null;
}): string | null {
  if (node.profile_id) return encodeProfileChoice(node.profile_id);
  return node.agent === null ? null : encodeRuntimeChoice(node.agent);
}

export function agentChoiceProfile(
  choice: string | null,
  profiles: AgentProfileContract[],
): AgentProfileContract | null {
  const decoded = decodeAgentChoice(choice);
  if (decoded === null || decoded.kind === "runtime") return null;
  return profiles.find((profile) => profile.id === decoded.id) ?? null;
}

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

export function resolveAgentChoice(
  preferred: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): string | null {
  if (isUsableAgentChoice(preferred, profiles, descriptors)) return preferred;
  const fallback = resolveRuntimeChoice(descriptors, null);
  return fallback ? encodeRuntimeChoice(fallback) : null;
}

export function resolveProfileChoice(
  preferred: string | null,
  profiles: AgentProfileContract[],
  descriptors: RuntimeDescriptor[],
): string | null {
  return agentChoiceProfile(preferred, profiles) !== null &&
    isUsableAgentChoice(preferred, profiles, descriptors)
    ? preferred
    : null;
}

export type AgentScope = "all" | "profiles" | "runtimes";

/** Provider options are the daemon's to refuse against the installed CLI, never this surface's to quietly rewrite. */
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
