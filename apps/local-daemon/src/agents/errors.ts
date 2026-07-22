import type { AgentProfileError } from "@otomat/domain";

import { RuntimeUnavailableError, UnknownRuntimeError } from "#runtime";

export class ProfileNotFoundError extends Error {
  constructor(readonly profileId: string) {
    super(`agent profile ${profileId} not found`);
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileOptionUnsupportedError extends Error {
  constructor(
    readonly runtime: string,
    readonly option: string,
    message: string,
  ) {
    super(message);
    this.name = "ProfileOptionUnsupportedError";
  }
}

export type SkillUnavailableCode = "skill_unknown" | "skill_unavailable";

export class SkillUnavailableError extends Error {
  constructor(
    readonly code: SkillUnavailableCode,
    readonly skillId: string,
    message: string,
  ) {
    super(message);
    this.name = "SkillUnavailableError";
  }
}

export interface AgentConfigErrorResponse {
  status: 400 | 404 | 409;
  error: AgentProfileError;
  message: string;
}

/** Maps a profile/skill/runtime resolution error to an honest HTTP refusal, or null when it is not one of ours. */
export function agentConfigErrorResponse(error: unknown): AgentConfigErrorResponse | null {
  if (error instanceof ProfileNotFoundError) {
    return { status: 404, error: "profile_not_found", message: error.message };
  }
  if (error instanceof UnknownRuntimeError) {
    return { status: 400, error: "runtime_unknown", message: error.message };
  }
  if (error instanceof RuntimeUnavailableError) {
    return { status: 409, error: "runtime_unavailable", message: error.message };
  }
  if (error instanceof ProfileOptionUnsupportedError) {
    return { status: 400, error: "option_unsupported", message: error.message };
  }
  if (error instanceof SkillUnavailableError) {
    return {
      status: error.code === "skill_unknown" ? 400 : 409,
      error: error.code,
      message: error.message,
    };
  }
  return null;
}
