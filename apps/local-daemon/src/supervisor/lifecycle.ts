import {
  getRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionProcess,
  updateRunStatus,
} from "@otomat/db";
import { agentSessionMachine, runMachine, stepRunMachine } from "@otomat/domain";

import { startSessionTail } from "#events";

import {
  carriedContributions,
  claimStepContributions,
  resolveCarriedContributions,
} from "./contribution/carry.js";
import { withCarriedContributions } from "./contribution/prompt.js";
import { failureReason } from "./fail-run.js";
import { waitForWorkerIdentity } from "./identity.js";
import { runInitCommandBatch, runStillLive } from "./init-commands.js";
import { settleRun } from "./settle/index.js";
import { clearWorkerStartEvidence } from "./start-gate.js";
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
  tail: ReturnType<typeof startSessionTail>,
): void {
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
  const { db, slots, inflight, claiming, waiting, aborting } = state;
  if (claiming.has(ctx.agentSessionId) || inflight.has(ctx.agentSessionId)) {
    throw new Error(`session ${ctx.agentSessionId} is already starting`);
  }
  claiming.set(ctx.agentSessionId, ctx.runId);
  // Recorded before the await so the queue a caller reports is the queue that drains.
  if (!slots.free) waiting.set(ctx.agentSessionId, ctx.runId);
  await slots.acquire();
  waiting.delete(ctx.agentSessionId);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    slots.release();
  };
  const abandon = (): void => {
    resolveCarriedContributions(state, ctx.agentSessionId, { kind: "released" });
    release();
  };

  let proc: SessionProcess | undefined;
  let tail: ReturnType<typeof startSessionTail> | undefined;
  try {
    if (!runStillLive(state, ctx.runId)) return abandon();

    advanceToRunning(state, ctx);
    if (ctx.worktreeInit !== undefined) {
      const initialized = await runInitCommandBatch(state, ctx.runId, {
        worktreePath: ctx.worktreePath,
        commands: ctx.worktreeInit.commands,
        label: ctx.worktreeInit.label,
        shouldContinue: () => runStillLive(state, ctx.runId),
      });
      if (!initialized) return abandon();
    }
    clearWorkerStartEvidence(ctx.agentSessionDir);
    claimStepContributions(state, ctx.stepRunId, ctx.agentSessionId);
    const carried = carriedContributions(state, ctx.agentSessionId);
    const prompt = withCarriedContributions(
      ctx.prompt,
      carried.map((row) => row.body),
    );
    proc = state.spawn({ ...ctx, prompt, mode, providerSessionId });
    state.starting.set(ctx.agentSessionId, {
      runId: ctx.runId,
      proc,
      turn: { agentSessionId: ctx.agentSessionId },
    });
    recordAgentSessionProcess(db, ctx.agentSessionId, { pid: proc.pid, pgid: proc.pgid });
    if (!(await waitForWorkerIdentity(ctx.agentSessionDir, proc.pid, proc.pgid))) {
      throw new Error(`worker ${proc.pid} exited before its identity could be recorded`);
    }
    const readyRun = getRun(db, ctx.runId);
    if (
      !readyRun ||
      runMachine.isTerminal(readyRun.status) ||
      aborting.has(ctx.runId) ||
      state.shuttingDown
    ) {
      proc.kill("SIGKILL");
      const exit = await proc.exited;
      if (readyRun && !runMachine.isTerminal(readyRun.status) && !aborting.has(ctx.runId)) {
        settleLive(state, ctx, exit);
      }
      return abandon();
    }
    tail = startSessionTail(state.db, state.dataDir, ctx.runId, ctx.agentSessionId);
    proc.start();
    // The released worker is the evidence, and it must land before the exit monitor can settle the batch.
    resolveCarriedContributions(state, ctx.agentSessionId, { kind: "delivered" });
    state.starting.delete(ctx.agentSessionId);
    trackTurn(state, ctx, proc, release, tail);
  } catch (error) {
    release();
    tail?.stop();
    if (proc) {
      proc.kill("SIGKILL");
      await proc.exited;
    }
    resolveCarriedContributions(state, ctx.agentSessionId, {
      kind: "failed",
      reason: failureReason(error),
    });
    if (!aborting.has(ctx.runId)) settleLive(state, ctx);
    throw error;
  } finally {
    state.starting.delete(ctx.agentSessionId);
    claiming.delete(ctx.agentSessionId);
  }
}
