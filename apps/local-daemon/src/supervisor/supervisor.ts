import { abortRun } from "./abort.js";
import { advanceRun } from "./advance.js";
import { fixRun, followUpRun, resumeRun, startRun } from "./commands.js";
import { terminateGracefully } from "./process.js";
import { recoverCompeteSelections, selectCompeteWinner } from "./promotion.js";
import { reconcileRuns } from "./reconcile.js";
import { createState, notifyAfterSettle } from "./state.js";
import type { Supervisor, SupervisorConfig } from "./types.js";

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const state = createState(config);
  state.advance = (runId) => advanceRun(state, runId);
  return {
    start: (request) => startRun(state, request),
    resume: (runId) => resumeRun(state, runId),
    fix: (runId, prompt) => fixRun(state, runId, prompt),
    followUp: (runId, prompt) => followUpRun(state, runId, prompt),
    selectWinner: (runId, groupId, stepRunId) =>
      selectCompeteWinner(state, runId, groupId, stepRunId),
    abort: (runId) => abortRun(state, runId),
    reconcile: () => {
      const recovered = recoverCompeteSelections(state);
      const report = reconcileRuns(state.db, state.dataDir, new Date().toISOString());
      const reconciled = [...recovered, ...report.reconciled];
      for (const outcome of reconciled) notifyAfterSettle(state, outcome);
      return { reconciled };
    },
    settle: async () => {
      // A settling step can chain the next one; drain until no turn is in flight.
      while (state.inflight.size > 0 || state.pending.size > 0) {
        await Promise.all([
          ...[...state.inflight.values()].map((handle) => handle.monitor),
          ...state.pending,
        ]);
      }
    },
    shutdown: async (graceMs) => {
      state.shuttingDown = true;
      // Signal every live worker group; each worker's own SIGTERM handler settles its turn on exit.
      await Promise.all(
        [...state.starting.values(), ...state.inflight.values()].map((handle) =>
          terminateGracefully(handle.proc, graceMs),
        ),
      );
      await Promise.all(state.pending);
    },
  };
}
