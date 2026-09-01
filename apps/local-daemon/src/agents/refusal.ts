import type { AgentProfileError } from "@otomat/domain";

import { ModelSelectionRefusedError, RuntimeUnavailableError, UnknownRuntimeError } from "#runtime";

import {
  ProfileNotFoundError,
  ProfileOptionUnsupportedError,
  ProfileProjectUnknownError,
  SkillResolutionError,
} from "./errors.js";

export interface AgentConfigRefusal {
  error: AgentProfileError;
  message: string;
}

/** The stable code behind a resolution failure, or null when the error is not one of ours. */
export function agentConfigRefusal(error: unknown): AgentConfigRefusal | null {
  if (error instanceof ProfileNotFoundError) {
    return { error: "profile_not_found", message: error.message };
  }
  if (error instanceof ProfileProjectUnknownError) {
    return { error: "profile_project_unknown", message: error.message };
  }
  if (error instanceof UnknownRuntimeError) {
    return { error: "runtime_unknown", message: error.message };
  }
  if (error instanceof RuntimeUnavailableError) {
    return { error: "runtime_unavailable", message: error.message };
  }
  if (error instanceof ProfileOptionUnsupportedError) {
    return { error: "option_unsupported", message: error.message };
  }
  if (error instanceof ModelSelectionRefusedError) {
    return { error: error.code, message: error.message };
  }
  if (error instanceof SkillResolutionError) {
    return { error: error.code, message: error.message };
  }
  return null;
}
