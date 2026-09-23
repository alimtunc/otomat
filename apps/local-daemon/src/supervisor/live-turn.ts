import { getRun } from "@otomat/db";

import type { startSessionTail } from "#events";

import { ingestRunInteractions } from "./interaction/index.js";
import { startIntervalPass } from "./interval-pass.js";
import { finishSettle } from "./pass-boundary.js";
import { settleRun, type SettleOptions } from "./settle/index.js";
import { trackPending, type SupervisorState } from "./state.js";
import type { ProcessExit, SessionProcess, TurnContext } from "./types.js";

/** Just behind the session tail's own interval, so a question reaches the operator within one poll of being written. */
const INTERACTION_INGEST_INTERVAL_MS = 250;

export async function settleLive(
  state: SupervisorState,
  ctx: TurnContext,
  exit?: ProcessExit,
): Promise<void> {
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
    await finishSettle(state, outcome);
  } catch (error) {
    console.error(`[otomat] run ${ctx.runId} settle failed`, error);
  }
}

/** The whole chain — settle, cleanup, and the advance that may start the next step — lives in `state.pending`, so `settle` and `shutdown` never observe a window where the turn is gone from `inflight` but its advance is still running. */
export function trackTurn(
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
        if (!state.aborting.has(ctx.runId)) await settleLive(state, ctx, exit);
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
