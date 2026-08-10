import { getAgentProfile, getSkill, type Db } from "@otomat/db";
import {
  modelSelectionFromId,
  PROVIDER_DEFAULT_MODEL,
  type ModelSelection,
  type ProviderOptions,
  type ResolvedAgentConfig,
} from "@otomat/domain";

import {
  isKnownRuntimeId,
  requireAvailableRuntime,
  resolveModelSelection,
  UnknownRuntimeError,
} from "#runtime";

import { ProfileNotFoundError, SkillResolutionError } from "./errors.js";
import { resolveOptions } from "./options.js";
import { hashContent } from "./skills/content.js";
import { resolveSkills } from "./skills/resolve.js";

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
