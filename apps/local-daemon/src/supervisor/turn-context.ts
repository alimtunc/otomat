import { getRun, recordAgentSessionContext } from "@otomat/db";

import {
  buildSessionContext,
  publicationDelta,
  renderPublicationDelta,
  renderSessionContext,
} from "#context";

import type { SupervisorState } from "./state.js";
import type { TurnContext } from "./types.js";

function compose(context: string | null, prompt: string | null): string | null {
  if (context === null) return prompt;
  if (prompt === null) return context;
  return `${context}\n\n---\n\n${prompt}`;
}

/** A native resume keeps the conversation the provider already holds, so it is handed no fresh dossier — only what Otomat durably recorded since, which that conversation would otherwise contradict. */
export function captureTurnContext(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume",
): string | null {
  const run = getRun(state.db, ctx.runId);
  if (!run) return ctx.prompt;
  if (mode === "resume") {
    const published = publicationDelta(state.db, run.id, ctx.agentSessionId);
    const delta = published === null ? null : renderPublicationDelta(published, run.branch);
    return compose(delta, ctx.prompt);
  }
  const context = buildSessionContext({
    db: state.db,
    repositories: state.repositories,
    run,
    stepRunId: ctx.stepRunId,
    selection: ctx.contextSelection,
    capturedAt: new Date().toISOString(),
  });
  recordAgentSessionContext(state.db, ctx.agentSessionId, context);
  return compose(renderSessionContext(context), ctx.prompt);
}
