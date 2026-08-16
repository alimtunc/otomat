import { getAgentProfile, getSkill, readExecutionDefaults, type Db } from "@otomat/db";
import {
  executionLevels,
  modelSelectionFromId,
  PROVIDER_DEFAULT_MODEL,
  resolveExecutionModel,
  type ExecutionDefaults,
  type ExecutionLevel,
  type ExecutionSource,
  type ProviderOptions,
  type ResolvedAgentConfig,
  type StoredExecutionConfig,
} from "@otomat/domain";

import {
  isKnownRuntimeId,
  requireAvailableRuntime,
  resolveModelSelection,
  UnknownRuntimeError,
} from "#runtime";

import { ProfileNotFoundError, SkillResolutionError } from "./errors.js";
import { assertOptionsAnnounced, resolveOptions } from "./options.js";
import { hashContent } from "./skills/content.js";
import { resolveSkills } from "./skills/resolve.js";

export type AgentConfigSelector =
  | { kind: "profile"; profileId: string }
  | { kind: "runtime"; runtimeId: string };

/** How a plan or preset node names its own agent; null inherits whatever the launch resolved. */
export function nodeAgentSelector(node: {
  agent: string | null;
  profile_id?: string | null;
}): AgentConfigSelector | null {
  if (node.profile_id) return { kind: "profile", profileId: node.profile_id };
  if (node.agent) return { kind: "runtime", runtimeId: node.agent };
  return null;
}

export interface ProfileInput {
  runtime: string;
  options: ProviderOptions;
  /** Null leaves the model to the host defaults. */
  model: string | null;
  skill_ids: string[];
}

export interface AgentConfigOverrides {
  /** Most specific first: a node's own level before the launch's. */
  levels?: readonly ExecutionLevel[];
  runtimeSource?: Extract<ExecutionSource, "step" | "launch" | "global">;
}

/** Runtime availability and skill files are checked at launch, not here. */
export function validateProfileInput(db: Db, input: ProfileInput): void {
  if (!isKnownRuntimeId(input.runtime)) throw new UnknownRuntimeError(input.runtime);
  const model = resolveModelSelection(input.runtime, modelSelectionFromId(input.model));
  assertOptionsAnnounced(input.runtime, model, input.options);
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

function resolveConfig(
  runtimeId: string,
  profile: StoredExecutionConfig | null,
  overrides: AgentConfigOverrides,
  defaults: ExecutionDefaults,
  identity: Pick<ResolvedAgentConfig, "profile_id" | "profile_name" | "guidance" | "skills">,
): ResolvedAgentConfig {
  const runtime = requireAvailableRuntime(runtimeId);
  const levels = executionLevels(overrides.levels ?? [], profile, defaults, runtime);
  const selectedModel = resolveExecutionModel(levels);
  const model = resolveModelSelection(runtime, selectedModel.value ?? PROVIDER_DEFAULT_MODEL);
  const options = resolveOptions(runtime, model, levels);
  return finalize({
    runtime,
    ...identity,
    options: options.options,
    model,
    sources: {
      runtime: overrides.runtimeSource ?? "launch",
      model: selectedModel.source,
      options: options.sources,
    },
  });
}

/** Throws a typed error before any spawn: the frozen config is only ever written from a resolution that fully succeeded. */
export function resolveAgentConfig(
  db: Db,
  selector: AgentConfigSelector,
  overrides: AgentConfigOverrides = {},
): ResolvedAgentConfig {
  const defaults = readExecutionDefaults(db);
  if (selector.kind === "runtime") {
    return resolveConfig(selector.runtimeId, null, overrides, defaults, {
      profile_id: null,
      profile_name: null,
      guidance: null,
      skills: [],
    });
  }
  const profile = getAgentProfile(db, selector.profileId);
  if (!profile) throw new ProfileNotFoundError(selector.profileId);
  return resolveConfig(
    profile.runtime,
    { model: profile.model, options: profile.options_json },
    overrides,
    defaults,
    {
      profile_id: profile.id,
      profile_name: profile.name,
      guidance: profile.guidance,
      skills: resolveSkills(db, profile.skill_ids_json),
    },
  );
}
