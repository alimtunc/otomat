import { getAgentProfile, getSkill, type Db } from "@otomat/db";
import {
  effortOptionDescriptor,
  modelSelectionFromId,
  PROVIDER_DEFAULT_MODEL,
  type ModelSelection,
  type ProviderOptionKey,
  type ProviderOptions,
  type ProviderOptionSet,
  type ResolvedAgentConfig,
  type ResolvedModel,
  type ResolvedSkill,
} from "@otomat/domain";

import {
  describeProviderOptions,
  isKnownRuntimeId,
  requireAvailableRuntime,
  resolveModelSelection,
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
  /** Null requests the provider's own default model. */
  model: string | null;
  skill_ids: string[];
}

export interface AgentConfigOverrides {
  /** Explicit model for this launch or plan node; absent inherits the selected config's own model. */
  model?: ModelSelection;
  /** Explicit effort level for this launch or plan node; absent keeps the effort the selected config already carries. */
  effort?: string;
}

const SKILL_INSTRUCTIONS_MAX_LENGTH = 64_000;

/**
 * Every selected option is checked against what the installed binary announced
 * for this runtime and model, so a key or value it does not offer — including a
 * mode retired by a CLI upgrade — is refused before it can reach argv. Only what
 * the probe actually answers is enforced: `ok` and `unsupported` are answers, a
 * `failed` probe is ignorance and must not turn a working profile into a refused
 * one.
 */
function validateOptions(
  runtime: KnownRuntimeId,
  support: ProviderOptionSet,
  options: ProviderOptions,
): void {
  if (support.detection.status === "failed") return;
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    const descriptor = support.options.find((candidate) => candidate.key === key);
    if (!descriptor) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not offer the "${key}" option here: ${support.detection.detail}`,
      );
    }
    if (!descriptor.choices.some((choice) => choice.value === value)) {
      throw new ProfileOptionUnsupportedError(
        `runtime "${runtime}" does not accept "${key}" value "${value}"; pick one of ${descriptor.choices.map((choice) => choice.value).join(", ")}`,
      );
    }
  }
}

/**
 * The key this runtime and model announce an effort under — `--effort` for one
 * provider, `model_reasoning_effort` for another. A pair that announces no effort
 * at all (an older Claude Code, a Codex model the catalog publishes no levels
 * for, an unreadable CLI) cannot honor the request, so it is refused rather than
 * dropped behind the caller's back.
 */
function effortOptionKey(runtime: KnownRuntimeId, support: ProviderOptionSet): ProviderOptionKey {
  const descriptor = effortOptionDescriptor(support.options);
  if (!descriptor) {
    throw new ProfileOptionUnsupportedError(
      `runtime "${runtime}" announces no effort level here: ${support.detection.detail}`,
    );
  }
  return descriptor.key;
}

/** The options a config really sends: its own, plus the requested effort, each checked against the installed binary. Selecting nothing skips the probe entirely. */
function resolveOptions(
  runtime: KnownRuntimeId,
  model: ResolvedModel | null,
  options: ProviderOptions,
  effort: string | undefined,
): ProviderOptions {
  const selected = Object.values(options).some((value) => value !== undefined);
  if (!selected && effort === undefined) return options;

  const support = describeProviderOptions(runtime, model?.id ?? null);
  const merged: ProviderOptions = { ...options };
  if (effort !== undefined) merged[effortOptionKey(runtime, support)] = effort;
  validateOptions(runtime, support, merged);
  return merged;
}

/** Static save-time validation: the runtime is known, its options and model are supported, and every referenced skill exists. Availability and skill files are checked at launch. */
export function validateProfileInput(db: Db, input: ProfileInput): void {
  if (!isKnownRuntimeId(input.runtime)) throw new UnknownRuntimeError(input.runtime);
  const model = resolveModelSelection(input.runtime, modelSelectionFromId(input.model));
  resolveOptions(input.runtime, model, input.options, undefined);
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
    model: config.model,
    guidance: config.guidance,
    skills: config.skills.map((skill) => ({ id: skill.id, hash: skill.content_hash })),
  };
  return hashContent(JSON.stringify(stable));
}

function finalize(config: Omit<ResolvedAgentConfig, "config_hash">): ResolvedAgentConfig {
  return { ...config, config_hash: configHash(config) };
}

/** Resolves a profile or ad-hoc runtime, plus any launch/node override, into the immutable config frozen into a run plan — throwing a typed error before any spawn. */
export function resolveAgentConfig(
  db: Db,
  selector: AgentConfigSelector,
  overrides: AgentConfigOverrides = {},
): ResolvedAgentConfig {
  if (selector.kind === "runtime") {
    const runtime = requireAvailableRuntime(selector.runtimeId);
    const model = resolveModelSelection(runtime, overrides.model ?? PROVIDER_DEFAULT_MODEL);
    return finalize({
      runtime,
      profile_id: null,
      profile_name: null,
      options: resolveOptions(runtime, model, {}, overrides.effort),
      model,
      guidance: null,
      skills: [],
    });
  }
  const profile = getAgentProfile(db, selector.profileId);
  if (!profile) throw new ProfileNotFoundError(selector.profileId);
  const runtime = requireAvailableRuntime(profile.runtime);
  // The launch model decides which options are legal, so it is resolved before they are checked.
  const model = resolveModelSelection(
    runtime,
    overrides.model ?? modelSelectionFromId(profile.model),
  );
  return finalize({
    runtime,
    profile_id: profile.id,
    profile_name: profile.name,
    options: resolveOptions(runtime, model, profile.options_json, overrides.effort),
    model,
    guidance: profile.guidance,
    skills: resolveSkills(db, profile.skill_ids_json),
  });
}
