import { IllegalTransitionError, InvalidRunPlanError } from "@otomat/domain";
import type { Context, Env } from "hono";

import type { AgentConfigSelector } from "#agents";
import { RuntimeUnavailableError } from "#runtime";
import { RunWorkspaceClosedError } from "#supervisor";

import { agentConfigErrorResponse, refusalJson } from "./agent-config-refusal.js";

/** The explicit agent choice every append-a-step request carries. */
interface AgentChoiceRequest {
  profile_id?: string;
  runtime?: string;
}

/** The agent the caller picked for an appended step; a profile always wins over an ad-hoc runtime. */
export function appendStepSelector(request: AgentChoiceRequest): AgentConfigSelector {
  if (request.profile_id) return { kind: "profile", profileId: request.profile_id };
  if (request.runtime) return { kind: "runtime", runtimeId: request.runtime };
  throw new Error("append step request passed validation without an agent");
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
  if (error instanceof RuntimeUnavailableError) {
    return c.json(
      {
        error: "runtime_unavailable",
        runtime: error.runtime,
        reason: error.reason,
        message: error.message,
      },
      409,
    );
  }
  const refusal = agentConfigErrorResponse(error);
  return refusal ? refusalJson(c, refusal) : null;
}
