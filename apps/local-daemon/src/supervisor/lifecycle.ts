import {
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionProcess,
  setStepNextTurnConfig,
  updateRunStatus,
} from "@otomat/db";
import { agentSessionMachine, isRunSettled, stepRunMachine } from "@otomat/domain";

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
import { ingestRunInteractions } from "./interaction/index.js";
import { startIntervalPass } from "./interval-pass.js";
import { clearLiveInput } from "./live-input.js";
import { capturePassStart, finishSettle } from "./pass-boundary.js";
import type { SlotGrant } from "./semaphore.js";
import { settleRun, type SettleOptions } from "./settle/index.js";
import { clearWorkerStartEvidence } from "./start-gate.js";
import { trackPending, type SupervisorState } from "./state.js";
import { driveRunTo, driveSessionTo, driveStepTo } from "./transitions.js";
import { captureTurnContext } from "./turn-context.js";
import type { ProcessExit, SessionProcess, TurnContext } from "./types.js";

/** Just behind the session tail's own interval, so a question reaches the operator within one poll of being written. */
const INTERACTION_INGEST_INTERVAL_MS = 250;

/** Advances only the turn's own step/session — siblings keep their state. The step machine decides what may reopen: a stopped step goes back to work, a succeeded one is left as delivered. */
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
    const settle: SettleOptions = {
      mode: "live",
      turn: { agentSessionId: ctx.agentSessionId },
      now: new Date().toISOString(),
    };
    if (exit) settle.observedExit = exit;
    const outcome = settleRun(state.db, state.dataDir, run, settle);
    finishSettle(state, outcome);
  } catch (error) {
    console.error(`[otomat] run ${ctx.runId} settle failed`, error);
  }
}

/** The whole chain — settle, cleanup, and the advance that may start the next step — lives in `state.pending`, so `settle` and `shutdown` never observe a window where the turn is gone from `inflight` but its advance is still running. */
function trackTurn(
  state: SupervisorState,
  ctx: TurnContext,
  proc: SessionProcess,
  tail: ReturnType<typeof startSessionTail>,
): void {
  // Paired with the tail because it reads what the tail just ingested: a question the turn asked is only answerable once it is a row.
  const interactions = startIntervalPass(
    `run ${ctx.runId} interactions`,
    async () => ingestRunInteractions(state.db, ctx.runId),
    INTERACTION_INGEST_INTERVAL_MS,
  );
  const monitor = trackPending(
    state,
    (async () => {
      const exit = await proc.exited;
      // Stopped before settling: settle owns the interaction lifecycle from here, and a pass firing mid-settle would race its state walk.
      interactions.stop();
      try {
        if (!state.aborting.has(ctx.runId)) settleLive(state, ctx, exit);
      } finally {
        tail.stop();
        state.inflight.delete(ctx.agentSessionId);
        state.slots.release();
      }
      if (state.aborting.has(ctx.runId)) return;
      await state.advance?.(ctx.runId);
    })().catch((error: unknown) =>
      console.error(`[otomat] run ${ctx.runId} turn monitor failed`, error),
    ),
  );
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
 * A slot wait canceled by abort or shutdown returns the carried batch to its queue
 * without ever holding a slot. Throws when the run is already claiming or in-flight.
 * A spawn failure kills any child and settles the run before rethrowing. The
 * run/step/session rows must already exist (via `prepareRun`).
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
  // Resolves before releasing, so a contribution failure here is settled by the catch's single release.
  const abandon = (): void => {
    resolveCarriedContributions(state, ctx.agentSessionId, { kind: "released" });
    slots.release();
  };

  let grant: SlotGrant | null = null;
  let proc: SessionProcess | undefined;
  let tail: ReturnType<typeof startSessionTail> | undefined;
  try {
    grant = await slots.acquire(ctx.agentSessionId);
    if (grant === "canceled") {
      resolveCarriedContributions(state, ctx.agentSessionId, { kind: "released" });
      return;
    }
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
    capturePassStart(state, ctx);
    clearWorkerStartEvidence(ctx.agentSessionDir);
    clearLiveInput(ctx.agentSessionDir);
    claimStepContributions(
      state,
      ctx.stepRunId,
      ctx.agentSessionId,
      ctx.config?.config_hash ?? null,
      ctx.carryContributionIds,
    );
    const carried = carriedContributions(state, ctx.agentSessionId);
    const prompt = withCarriedContributions(
      captureTurnContext(state, ctx, mode),
      carried.map((row) => row.body),
    );
    // The selection is already rendered into `prompt`; a job is serialized into the worker's env, so it must not carry it twice.
    const { contextSelection: _frozen, carryContributionIds: _carried, ...turn } = ctx;
    proc = state.spawn({ ...turn, prompt, mode, providerSessionId });
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
      isRunSettled(readyRun.status) ||
      aborting.has(ctx.runId) ||
      state.shuttingDown
    ) {
      proc.kill("SIGKILL");
      const exit = await proc.exited;
      if (readyRun && !isRunSettled(readyRun.status) && !aborting.has(ctx.runId)) {
        settleLive(state, ctx, exit);
      }
      return abandon();
    }
    tail = startSessionTail(state.db, state.dataDir, ctx.runId, ctx.agentSessionId);
    proc.start();
    const pendingConfig = getStepRun(db, ctx.stepRunId)?.next_turn_config_json;
    if (pendingConfig != null && pendingConfig.config_hash === ctx.config?.config_hash) {
      setStepNextTurnConfig(db, ctx.stepRunId, null);
    }
    // The released worker is the evidence, and it must land before the exit monitor can settle the batch.
    resolveCarriedContributions(state, ctx.agentSessionId, { kind: "delivered" });
    state.starting.delete(ctx.agentSessionId);
    trackTurn(state, ctx, proc, tail);
  } catch (error) {
    tail?.stop();
    if (proc) {
      proc.kill("SIGKILL");
      await proc.exited;
    }
    if (grant === "acquired") slots.release();
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
