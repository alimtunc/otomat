import { z } from "zod";

import { providerOptionsSchema } from "../runtime.js";

/** Where a discovered skill came from: a registered project's tree, or the user's home skills. */
export const SKILL_SOURCES = ["project", "user"] as const;
export const skillSourceSchema = z.enum(SKILL_SOURCES);
export type SkillSource = (typeof SKILL_SOURCES)[number];

/** Why a discovered skill cannot be activated; safe to show verbatim in the UI. */
export const SKILL_INVALID_REASONS = [
  "frontmatter_missing",
  "name_missing",
  "unreadable",
  "path_missing",
] as const;
export const skillInvalidReasonSchema = z.enum(SKILL_INVALID_REASONS);
export type SkillInvalidReason = (typeof SKILL_INVALID_REASONS)[number];

export const SKILL_STATUSES = ["available", "invalid"] as const;
export const skillStatusSchema = z.enum(SKILL_STATUSES);
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** One discovered local skill — declarative instructions with filesystem provenance. Otomat never executes it. */
export const skillContractSchema = z.object({
  id: z.string(),
  source: skillSourceSchema,
  /** Canonical (realpath) absolute path to the skill's `SKILL.md`; stable identity across symlinks. */
  canonical_path: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  /** Hash of the skill file's contents; changes whenever the on-disk instructions change. Null when unreadable. */
  content_hash: z.string().nullable(),
  status: skillStatusSchema,
  invalid_reason: skillInvalidReasonSchema.nullable(),
  /** Whether this skill may be activated by a profile. */
  enabled: z.boolean(),
});
export type SkillContract = z.infer<typeof skillContractSchema>;

/** A skill frozen into a run plan so a resume stays reproducible if the source file changes. */
export const resolvedSkillSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  source: skillSourceSchema,
  canonical_path: z.string(),
  content_hash: z.string(),
  /** The skill instructions captured at launch. Otomat surfaces this as text; it is never executed. */
  instructions: z.string(),
});
export type ResolvedSkill = z.infer<typeof resolvedSkillSchema>;

/** The effective agent configuration frozen at launch; later actions never read the live profile. */
export const resolvedAgentConfigSchema = z.object({
  runtime: z.string(),
  /** Profile this config resolved from; null for an ad-hoc runtime launch. */
  profile_id: z.string().nullable(),
  profile_name: z.string().nullable(),
  options: providerOptionsSchema,
  guidance: z.string().nullable(),
  skills: z.array(resolvedSkillSchema),
  /** Integrity fingerprint computed at freeze and stable across resume. */
  config_hash: z.string(),
});
export type ResolvedAgentConfig = z.infer<typeof resolvedAgentConfigSchema>;

/** Mutable launch configuration whose effective snapshot is frozen into each run plan. */
export const agentProfileContractSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  runtime: z.string(),
  options: providerOptionsSchema,
  guidance: z.string().nullable(),
  /** Ids of skills resolved and validated at launch. */
  skill_ids: z.array(z.string()),
});
export type AgentProfileContract = z.infer<typeof agentProfileContractSchema>;
