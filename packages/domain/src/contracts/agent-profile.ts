import { z } from "zod";

import { providerOptionsSchema } from "./runtime.js";

export const AGENT_PROFILE_NAME_MAX_LENGTH = 80;
export const AGENT_PROFILE_GUIDANCE_MAX_LENGTH = 20_000;
export const AGENT_PROFILE_MAX_SKILLS = 32;

/** Why a profile write or resolution was refused; safe to show verbatim in the UI. */
export const AGENT_PROFILE_ERRORS = [
  "profile_not_found",
  "runtime_unknown",
  "runtime_unavailable",
  "option_unsupported",
  "skill_unknown",
  "skill_unavailable",
] as const;
export type AgentProfileError = (typeof AGENT_PROFILE_ERRORS)[number];

/** Create or replace a profile. Options are validated against the chosen runtime's advertised options server-side. */
export const saveAgentProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(AGENT_PROFILE_NAME_MAX_LENGTH),
  runtime: z.string().min(1),
  options: providerOptionsSchema.optional(),
  guidance: z.string().trim().max(AGENT_PROFILE_GUIDANCE_MAX_LENGTH).nullish(),
  skill_ids: z.array(z.string().min(1)).max(AGENT_PROFILE_MAX_SKILLS).optional(),
});
export type SaveAgentProfileRequest = z.infer<typeof saveAgentProfileRequestSchema>;

/** Stable refusal code plus a user-facing daemon message. */
export const agentProfileErrorSchema = z.object({
  error: z.enum(AGENT_PROFILE_ERRORS),
  message: z.string(),
});
