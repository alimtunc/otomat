import type { AgentProfileError } from "@otomat/domain";
import type { Context, Env } from "hono";

import { ProfileNotFoundError, ProfileOptionUnsupportedError, SkillResolutionError } from "#agents";
import { UnknownRuntimeError } from "#runtime";

export interface AgentConfigErrorResponse {
  status: 400 | 404 | 409;
  error: AgentProfileError;
  message: string;
}

export function refusalJson<E extends Env>(c: Context<E>, refusal: AgentConfigErrorResponse) {
  return c.json({ error: refusal.error, message: refusal.message }, refusal.status);
}

/** Maps a profile/skill/runtime resolution error to an honest HTTP refusal, or null when it is not one of ours. */
export function agentConfigErrorResponse(error: unknown): AgentConfigErrorResponse | null {
  if (error instanceof ProfileNotFoundError) {
    return { status: 404, error: "profile_not_found", message: error.message };
  }
  if (error instanceof UnknownRuntimeError) {
    return { status: 400, error: "runtime_unknown", message: error.message };
  }
  if (error instanceof ProfileOptionUnsupportedError) {
    return { status: 400, error: "option_unsupported", message: error.message };
  }
  if (error instanceof SkillResolutionError) {
    return {
      status: error.code === "skill_unknown" ? 400 : 409,
      error: error.code,
      message: error.message,
    };
  }
  return null;
}
