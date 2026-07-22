import type { AgentProfileError } from "@otomat/domain";

export class ProfileNotFoundError extends Error {
  constructor(readonly profileId: string) {
    super(`agent profile ${profileId} not found`);
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileOptionUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileOptionUnsupportedError";
  }
}

export type SkillResolutionCode = Extract<AgentProfileError, "skill_unknown" | "skill_unavailable">;

export class SkillResolutionError extends Error {
  constructor(
    readonly code: SkillResolutionCode,
    message: string,
  ) {
    super(message);
    this.name = "SkillResolutionError";
  }
}
