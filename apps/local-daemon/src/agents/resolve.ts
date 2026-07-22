import { getAgentProfile, getSkill, type Db } from "@otomat/db";
import type { ProviderOptions, ResolvedAgentConfig, ResolvedSkill } from "@otomat/domain";

import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  requireAvailableRuntime,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

import {
  ProfileNotFoundError,
  ProfileOptionUnsupportedError,
  SkillResolutionError,
} from "./errors.js";
import { hashContent, readSkillContent } from "./skills/content.js";

/** How a launch chose its agent: a saved profile, or an ad-hoc runtime id. */
export type AgentConfigSelector =
  | { kind: "profile"; profileId: string }
  | { kind: "runtime"; runtimeId: string };

/** Whatever the daemon accepts as a profile write, validated statically before persistence. */
export interface ProfileInput {
  runtime: string;
  options: ProviderOptions;
  skill_ids: string[];
}

const SKILL_INSTRUCTIONS_MAX_LENGTH = 64_000;

function validateOptions(runtime: KnownRuntimeId, options: ProviderOptions): void {
  const descriptors = createRuntimeAdapter(runtime).providerOptions;
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    const descriptor = descriptors.find((candidate) => candidate.key === key);
    if (!descriptor) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not support the "${key}" option`,
      );
    }
    if (!descriptor.choices.some((choice) => choice.value === value)) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not support "${key}" value "${String(value)}"`,
      );
    }
  }
}

/** Static save-time validation: the runtime is known, its options are supported, and every referenced skill exists. Availability and skill files are checked at launch. */
export function validateProfileInput(db: Db, input: ProfileInput): void {
  if (!isKnownRuntimeId(input.runtime)) throw new UnknownRuntimeError(input.runtime);
  validateOptions(input.runtime, input.options);
  for (const skillId of input.skill_ids) {
    if (!getSkill(db, skillId)) {
      throw new SkillResolutionError("skill_unknown", `skill ${skillId} is not in the catalog`);
    }
  }
}

function resolveSkills(db: Db, skillIds: readonly string[]): ResolvedSkill[] {
  return skillIds.map((id) => {
    const skill = getSkill(db, id);
    if (!skill) {
      throw new SkillResolutionError("skill_unknown", `skill ${id} is not in the catalog`);
    }
    if (!skill.enabled) {
      throw new SkillResolutionError("skill_unavailable", `skill "${skill.name}" is disabled`);
    }
    if (skill.status !== "available") {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" is ${skill.invalid_reason ?? "invalid"}`,
      );
    }
    const content = readSkillContent(skill.canonical_path);
    if (content === null) {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" file is unreadable`,
      );
    }
    if (content.content.length > SKILL_INSTRUCTIONS_MAX_LENGTH) {
      throw new SkillResolutionError(
        "skill_unavailable",
        `skill "${skill.name}" exceeds the ${SKILL_INSTRUCTIONS_MAX_LENGTH}-character limit`,
      );
    }
    return {
      id: skill.id,
      name: skill.name,
      source: skill.source,
      canonical_path: skill.canonical_path,
      content_hash: content.hash,
      instructions: content.content,
    };
  });
}

function configHash(config: Omit<ResolvedAgentConfig, "config_hash">): string {
  const stable = {
    runtime: config.runtime,
    profile_id: config.profile_id,
    options: config.options,
    guidance: config.guidance,
    skills: config.skills.map((skill) => ({ id: skill.id, hash: skill.content_hash })),
  };
  return hashContent(JSON.stringify(stable));
}

function finalize(config: Omit<ResolvedAgentConfig, "config_hash">): ResolvedAgentConfig {
  return { ...config, config_hash: configHash(config) };
}

/**
 * Resolves a profile or ad-hoc runtime into the effective, immutable agent
 * configuration frozen into a run plan. Reads skill files and validates runtime
 * availability, options, and skills, throwing a typed error before any spawn.
 */
export function resolveAgentConfig(db: Db, selector: AgentConfigSelector): ResolvedAgentConfig {
  if (selector.kind === "runtime") {
    const runtime = requireAvailableRuntime(selector.runtimeId);
    return finalize({
      runtime,
      profile_id: null,
      profile_name: null,
      options: {},
      guidance: null,
      skills: [],
    });
  }
  const profile = getAgentProfile(db, selector.profileId);
  if (!profile) throw new ProfileNotFoundError(selector.profileId);
  const runtime = requireAvailableRuntime(profile.runtime);
  validateOptions(runtime, profile.options_json);
  return finalize({
    runtime,
    profile_id: profile.id,
    profile_name: profile.name,
    options: profile.options_json,
    guidance: profile.guidance,
    skills: resolveSkills(db, profile.skill_ids_json),
  });
}
