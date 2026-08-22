import { IllegalTransitionError, InvalidRunPlanError } from "@otomat/domain";
import type { Context, Env } from "hono";

import type { AgentConfigSelector } from "#agents";
import { RunWorkspaceClosedError } from "#supervisor";

import { agentConfigErrorResponse } from "./agent-config-refusal.js";
import { refusalJson } from "./refusal.js";
import { runtimeUnavailableResponse } from "./runtime-unavailable.js";

export function appendStepSelector(request: { profile_id: string }): AgentConfigSelector {
  return { kind: "profile", profileId: request.profile_id };
}

/**
 * Maps every refusal an append can raise to an honest HTTP answer, or null when
 * the error is a daemon fault the caller must see as a 500. The workspace and
 * issue refusals are the merge guard: a merged issue is `done`, so the issue
 * machine itself is what says no.
 */
export function stepAppendErrorResponse<E extends Env>(
  c: Context<E>,
  error: unknown,
): Response | null {
  if (error instanceof RunWorkspaceClosedError) {
    return c.json(
      {
        error: "workspace_closed",
        message: "This issue's workspace is closed; start a new run to continue its work.",
      },
      409,
    );
  }
  if (error instanceof IllegalTransitionError && error.machine === "issue") {
    return c.json({ error: "issue_closed", message: error.message }, 409);
  }
  if (error instanceof InvalidRunPlanError) {
    return c.json({ error: "invalid_revision", message: error.message }, 409);
  }
  const runtimeRefusal = runtimeUnavailableResponse(c, error);
  if (runtimeRefusal) return runtimeRefusal;
  const refusal = agentConfigErrorResponse(error);
  return refusal ? refusalJson(c, refusal) : null;
}
