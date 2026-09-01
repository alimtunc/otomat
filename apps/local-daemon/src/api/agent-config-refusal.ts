import type { AgentProfileError } from "@otomat/domain";

import { agentConfigRefusal } from "#agents";

export interface AgentConfigErrorResponse {
  status: 400 | 404 | 409;
  error: AgentProfileError;
  message: string;
}

/** Exhaustive by type: a new refusal code cannot ship without an HTTP answer. */
const REFUSAL_STATUS = {
  profile_not_found: 404,
  runtime_unknown: 400,
  runtime_unavailable: 409,
  option_unsupported: 400,
  model_unknown: 400,
  skill_unknown: 400,
  skill_unavailable: 409,
  skill_out_of_scope: 409,
  profile_project_unknown: 404,
} satisfies Record<AgentProfileError, AgentConfigErrorResponse["status"]>;

/** Maps a profile/skill/runtime resolution error to an honest HTTP refusal, or null when it is not one of ours. */
export function agentConfigErrorResponse(error: unknown): AgentConfigErrorResponse | null {
  const refusal = agentConfigRefusal(error);
  return refusal === null ? null : { status: REFUSAL_STATUS[refusal.error], ...refusal };
}
