import { randomUUID } from "node:crypto";

import {
  getRun,
  insertAgentSession,
  listStepRunsForRun,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { agentSessionMachine, nextReadyStep, runMachine, type StepRunState } from "@otomat/domain";

import { runDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { ensureRuntimeAgent } from "./runtime-selection.js";
import type { SupervisorState } from "./state.js";
import { driveTurnConvergence } from "./transitions.js";

function stepStatuses(steps: readonly StepRunRow[]): Map<string, StepRunState> {
  return new Map(steps.map((step) => [step.id, step.status]));
}

/**
 * Starts the next ready plan step as a fresh turn with its own agent session.
 * Returns false when no step is ready (the settle path owns run convergence).
 */
export async function startNextReadyStep(state: SupervisorState, run: RunRow): Promise<boolean> {
  const steps = listStepRunsForRun(state.db, run.id);
  const next = nextReadyStep(run.plan_json, stepStatuses(steps));
  if (next === null) return false;

  const runtime = ensureRuntimeAgent(state.db, next.agent ?? undefined);
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
      prompt: next.prompt ?? "",
      runDir: runDir(state.dataDir, run.id),
      worktreePath: state.worktrees?.service.get(run.id)?.path ?? null,
      runtime,
    },
    "run",
    null,
  );
  return true;
}

/**
 * Live chain after a step settles `completed` with the run still `running`:
 * start whatever step became ready. A step that cannot start (runtime gone,
 * spawn failure) settles the run as failed — never a silent stall.
 */
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
    driveTurnConvergence(
      state.db,
      current,
      { step: null, session: null },
      { run: "failed", step: "canceled", session: "terminated" },
      listStepRunsForRun(state.db, runId),
      new Date().toISOString(),
    );
  }
}
