import {
  getRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionProcess,
  updateRunStatus,
} from "@otomat/db";
import { agentSessionMachine, runMachine, stepRunMachine } from "@otomat/domain";

import { startSessionTail } from "#events";

import { writeWorkerIdentity } from "./identity.js";
import { settleRun } from "./settle/index.js";
import { notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveRunTo, driveSessionTo, driveStepTo } from "./transitions.js";
import type { ProcessExit, SessionProcess, TurnContext } from "./types.js";

/** Advances only the turn's own step/session — siblings keep their state, and a follow-up's already-terminal rows are never reopened. */
function advanceToRunning(state: SupervisorState, ctx: TurnContext): void {
  const { db } = state;
  const now = new Date().toISOString();
  const run = getRun(db, ctx.runId);
  if (!run) throw new Error(`run ${ctx.runId} vanished before spawn`);
  driveRunTo(db, ctx.runId, run.status, "running", now);
  if (!run.started_at) updateRunStatus(db, ctx.runId, { status: "running", started_at: now });
  const step = listStepRunsForRun(db, ctx.runId).find((row) => row.id === ctx.stepRunId);
  const session = listAgentSessionsForRun(db, ctx.runId).find(
    (row) => row.id === ctx.agentSessionId,
  );
  if (!step || !session) throw new Error(`run ${ctx.runId} turn rows vanished before spawn`);
  if (!stepRunMachine.isTerminal(step.status)) driveStepTo(db, step.id, step.status, "running");
  if (!agentSessionMachine.isTerminal(session.status)) {
    driveSessionTo(db, session.id, session.status, "active");
  }
}

function settleLive(state: SupervisorState, ctx: TurnContext, exit?: ProcessExit): void {
  const run = getRun(state.db, ctx.runId);
  if (!run) return;
  try {
    const outcome = settleRun(state.db, state.dataDir, run, {
      mode: "live",
      ...(exit ? { observedExit: exit } : {}),
      turn: { agentSessionId: ctx.agentSessionId },
      now: new Date().toISOString(),
    });
    notifyAfterSettle(state, outcome);
  } catch (error) {
    console.error(`[otomat] run ${ctx.runId} settle failed`, error);
  }
}

function trackTurn(
  state: SupervisorState,
  ctx: TurnContext,
  proc: SessionProcess,
  release: () => void,
): void {
  const tail = startSessionTail(state.db, state.dataDir, ctx.runId, ctx.agentSessionId);
  const monitor = proc.exited
    .then((exit) => {
      if (!state.aborting.has(ctx.runId)) settleLive(state, ctx, exit);
    })
    .catch((error) => console.error(`[otomat] run ${ctx.runId} monitor failed`, error))
    .finally(() => {
      tail.stop();
      state.inflight.delete(ctx.agentSessionId);
      release();
    })
    // Chained after the slot release so the next plan step can claim it; a no-op unless the run is still `running` with a ready step.
    .then(() => {
      if (state.aborting.has(ctx.runId)) return;
      return state.advance?.(ctx.runId);
    })
    .catch((error) => console.error(`[otomat] run ${ctx.runId} step chain failed`, error));
  state.inflight.set(ctx.agentSessionId, {
    runId: ctx.runId,
    proc,
    monitor,
    tail,
    turn: { agentSessionId: ctx.agentSessionId },
  });
}

/**
 * Advances a prepared run to `running`, spawns its worker, and tracks it to exit.
 * Awaits a concurrency slot first, then re-checks the run wasn't aborted or made
 * terminal while waiting — if it was, releases the slot and returns without spawning.
 * Throws when the run is already claiming or in-flight. A spawn failure kills any child
 * and settles the run before rethrowing. The run/step/session rows must already exist
 * (via `prepareRun`).
 */
export async function spawnTurn(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume",
  providerSessionId: string | null,
): Promise<void> {
  const { db, slots, inflight, claiming, aborting } = state;
  if (claiming.has(ctx.agentSessionId) || inflight.has(ctx.agentSessionId)) {
    throw new Error(`session ${ctx.agentSessionId} is already starting`);
  }
  claiming.set(ctx.agentSessionId, ctx.runId);
  await slots.acquire();
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    slots.release();
  };

  let proc: SessionProcess | undefined;
  try {
    // A slot can take a while to free; an abort/cancel may have landed meanwhile.
    const current = getRun(db, ctx.runId);
    if (
      !current ||
      runMachine.isTerminal(current.status) ||
      aborting.has(ctx.runId) ||
      state.shuttingDown
    ) {
      release();
      return;
    }

    advanceToRunning(state, ctx);
    proc = state.spawn({ ...ctx, mode, providerSessionId });
    recordAgentSessionProcess(db, ctx.agentSessionId, { pid: proc.pid, pgid: proc.pgid });
    // Stamp the process identity next to its pid so a later boot proves the group is still ours before killing it.
    writeWorkerIdentity(ctx.runDir, proc.pid, proc.pgid);
    trackTurn(state, ctx, proc, release);
  } catch (error) {
    release();
    // A turn that failed mid-flight must not leave a live child or a phantom "running" row.
    proc?.kill("SIGKILL");
    settleLive(state, ctx);
    throw error;
  } finally {
    claiming.delete(ctx.agentSessionId);
  }
}
