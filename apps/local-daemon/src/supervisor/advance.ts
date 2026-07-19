import { randomUUID } from "node:crypto";

import { getRun, insertAgentSession, listStepRunsForRun, type RunRow } from "@otomat/db";
import { agentSessionMachine, nextReadyStep, runMachine } from "@otomat/domain";

import { emitLedgerEvent, sessionDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { buildTerminalMarker } from "./markers.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import { stepStatuses } from "./settle/index.js";
import { notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveIdleRunTo } from "./transitions.js";

/** Starts the next ready plan step as a fresh turn; false when none is ready (the settle path owns run convergence). */
export async function startNextReadyStep(state: SupervisorState, run: RunRow): Promise<boolean> {
  const steps = listStepRunsForRun(state.db, run.id);
  const next = nextReadyStep(run.plan_json, stepStatuses(steps));
  if (next === null) return false;
  if (next.agent === null || next.prompt === null) {
    throw new Error(`run ${run.id} frozen plan step ${next.id} is missing its agent or prompt`);
  }

  const runtime = ensureRuntimeAgent(state.db, next.agent);
  const agentSessionId = randomUUID();
  insertAgentSession(state.db, {
    id: agentSessionId,
    step_run_id: next.id,
    agent_id: runtime,
    status: agentSessionMachine.initial,
  });
  await spawnTurn(
    state,
    {
      runId: run.id,
      stepRunId: next.id,
      agentSessionId,
      prompt: next.prompt,
      runDir: sessionDir(state.dataDir, run.id, agentSessionId),
      worktreePath:
        state.repositories.forRepository(run.repository_id)?.service.get(run.id)?.path ?? null,
      runtime,
    },
    "run",
    null,
  );
  return true;
}

/** Live chain after a completed step: a step that cannot start settles the run as failed — never a silent stall. */
export async function advanceRun(state: SupervisorState, runId: string): Promise<void> {
  const run = getRun(state.db, runId);
  if (!run || run.status !== "running") return;
  if (state.inflight.has(runId) || state.claiming.has(runId) || state.aborting.has(runId)) return;

  try {
    await startNextReadyStep(state, run);
  } catch (error) {
    console.error(`[otomat] run ${runId} failed to start its next step`, error);
    const current = getRun(state.db, runId);
    if (!current || runMachine.isTerminal(current.status) || state.inflight.has(runId)) return;
    const now = new Date().toISOString();
    driveIdleRunTo(state.db, current, "failed", listStepRunsForRun(state.db, runId), now);
    const ref = { runId, stepRunId: null, agentSessionId: null };
    emitLedgerEvent(
      state.db,
      state.dataDir,
      runId,
      buildTerminalMarker(ref, "failed", null, 0, now),
    );
    notifyAfterSettle(state, {
      runId,
      classification: "failed",
      reason: `next step failed to start: ${error instanceof Error ? error.message : String(error)}`,
      orphanTerminated: false,
      providerSessionId: null,
    });
  }
}
