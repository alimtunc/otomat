import { getRun, recordAgentSessionContext } from "@otomat/db";

import { buildSessionContext, renderSessionContext } from "#context";

import type { SupervisorState } from "./state.js";
import type { TurnContext } from "./types.js";

/** A native resume passes through untouched: the provider still holds the conversation, so a fresh context would contradict what that session already knows. */
export function captureTurnContext(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume",
): string | null {
  if (mode === "resume") return ctx.prompt;
  const run = getRun(state.db, ctx.runId);
  if (!run) return ctx.prompt;
  const context = buildSessionContext({
    db: state.db,
    repositories: state.repositories,
    run,
    stepRunId: ctx.stepRunId,
    selection: ctx.contextSelection,
    capturedAt: new Date().toISOString(),
  });
  recordAgentSessionContext(state.db, ctx.agentSessionId, context);
  const rendered = renderSessionContext(context);
  return ctx.prompt === null ? rendered : `${rendered}\n\n---\n\n${ctx.prompt}`;
}
