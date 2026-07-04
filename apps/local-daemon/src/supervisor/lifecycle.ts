import {
  getRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionProcess,
  updateRunStatus,
} from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { writeWorkerIdentity } from "./identity.js";
import { runDir, startLiveTail } from "./run-events.js";
import { settleRun } from "./settle.js";
import type { SupervisorState } from "./state.js";
import { driveRunTo, driveStepsAndSessionsTo } from "./transitions.js";
import type { ProcessExit, SessionProcess, TurnContext } from "./types.js";

function advanceToRunning(state: SupervisorState, ctx: TurnContext): void {
  const { db } = state;
  const now = new Date().toISOString();
  const run = getRun(db, ctx.runId);
  if (!run) throw new Error(`run ${ctx.runId} vanished before spawn`);
  driveRunTo(db, ctx.runId, run.status, "running", now);
  if (!run.started_at) updateRunStatus(db, ctx.runId, { status: "running", started_at: now });
  driveStepsAndSessionsTo(
    db,
    listStepRunsForRun(db, ctx.runId),
    listAgentSessionsForRun(db, ctx.runId),
    "running",
    "active",
  );
}

function settleLive(state: SupervisorState, ctx: TurnContext, exit?: ProcessExit): void {
  const run = getRun(state.db, ctx.runId);
  if (!run) return;
  try {
    settleRun(state.db, state.dataDir, run, {
      mode: "live",
      ...(exit ? { observedExit: exit } : {}),
      now: new Date().toISOString(),
    });
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
  const tail = startLiveTail(state.db, state.dataDir, ctx.runId);
  const monitor = proc.exited
    .then((exit) => {
      if (!state.aborting.has(ctx.runId)) settleLive(state, ctx, exit);
    })
    .catch((error) => console.error(`[otomat] run ${ctx.runId} monitor failed`, error))
    .finally(() => {
      tail.stop();
      state.inflight.delete(ctx.runId);
      release();
    });
  state.inflight.set(ctx.runId, { proc, monitor, tail });
}

export async function spawnTurn(
  state: SupervisorState,
  ctx: TurnContext,
  mode: "run" | "resume",
  providerSessionId: string | null,
): Promise<void> {
  const { db, slots, inflight, claiming, aborting } = state;
  if (claiming.has(ctx.runId) || inflight.has(ctx.runId)) {
    throw new Error(`run ${ctx.runId} is already starting`);
  }
  claiming.add(ctx.runId);
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
    if (!current || runMachine.isTerminal(current.status) || aborting.has(ctx.runId)) {
      release();
      return;
    }

    advanceToRunning(state, ctx);
    proc = state.spawn({ ...ctx, mode, providerSessionId });
    recordAgentSessionProcess(db, ctx.agentSessionId, { pid: proc.pid, pgid: proc.pgid });
    // Stamp the process identity next to its pid so a later boot proves the group is still ours before killing it.
    writeWorkerIdentity(runDir(state.dataDir, ctx.runId), proc.pid, proc.pgid);
    trackTurn(state, ctx, proc, release);
  } catch (error) {
    release();
    // A turn that failed mid-flight must not leave a live child or a phantom "running" row.
    proc?.kill("SIGKILL");
    settleLive(state, ctx);
    throw error;
  } finally {
    claiming.delete(ctx.runId);
  }
}
