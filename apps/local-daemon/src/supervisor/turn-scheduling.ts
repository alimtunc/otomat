import { randomUUID } from "node:crypto";

import { insertAgentSession, type RunRow } from "@otomat/db";
import { agentSessionMachine, type RunPlanCompetitor } from "@otomat/domain";

import { sessionDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import type { TurnContext } from "./types.js";

export function insertTurn(
  state: SupervisorState,
  run: RunRow,
  step: RunPlanCompetitor,
  worktreePath: string,
): TurnContext {
  if (step.agent === null || step.prompt === null) {
    throw new Error(`run ${run.id} frozen plan step ${step.id} is missing its agent or prompt`);
  }
  const runtime = ensureRuntimeAgent(state.db, step.agent);
  const agentSessionId = randomUUID();
  insertAgentSession(state.db, {
    id: agentSessionId,
    step_run_id: step.id,
    agent_id: runtime,
    status: agentSessionMachine.initial,
  });
  return {
    runId: run.id,
    stepRunId: step.id,
    agentSessionId,
    prompt: step.prompt,
    agentSessionDir: sessionDir(state.dataDir, run.id, agentSessionId),
    worktreePath,
    runtime,
    config: step.config ?? null,
  };
}

export function scheduleTurn(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume" = "run",
  providerSessionId: string | null = null,
): Promise<void> {
  let pending: Promise<void>;
  pending = spawnTurn(state, ctx, mode, providerSessionId)
    .then(
      () => undefined,
      (error: unknown) => {
        console.error(
          `[otomat] run ${ctx.runId} competitor ${ctx.stepRunId} failed to start`,
          error,
        );
      },
    )
    .finally(() => state.pending.delete(pending));
  state.pending.add(pending);
  return pending;
}
