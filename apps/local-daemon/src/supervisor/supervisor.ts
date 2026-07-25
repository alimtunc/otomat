import { abortRun } from "./abort.js";
import { advanceRun } from "./advance.js";
import { fixRun, resumeRun, startRun } from "./commands.js";
import {
  contributeToRun,
  deliverQueuedContributions,
  reconcileContributionClaims,
  retryRunContribution,
} from "./contributions.js";
import { terminateGracefully } from "./process.js";
import { recoverCompeteSelections, selectCompeteWinner } from "./promotion.js";
import { reconcileRuns } from "./reconcile.js";
import { createState, notifyAfterSettle } from "./state.js";
import type { Supervisor, SupervisorConfig } from "./types.js";

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const state = createState(config);
  // The post-turn chain is the only automatic delivery trigger: queued messages ride the next safe turn.
  state.advance = async (runId) => {
    await advanceRun(state, runId);
    await deliverQueuedContributions(state, runId);
  };
  return {
    start: (request) => startRun(state, request),
    resume: (runId) => resumeRun(state, runId),
    fix: (runId, prompt) => fixRun(state, runId, prompt),
    contribute: (runId, body) => contributeToRun(state, runId, body),
    retryContribution: (runId, contributionId) =>
      retryRunContribution(state, runId, contributionId),
    deliverContributions: (runId) => deliverQueuedContributions(state, runId),
    selectWinner: (runId, groupId, stepRunId) =>
      selectCompeteWinner(state, runId, groupId, stepRunId),
    abort: (runId) => abortRun(state, runId),
    reconcile: () => {
      const now = new Date().toISOString();
      // Resolve delivery claims first so the run settles below can judge them from turn evidence.
      reconcileContributionClaims(state.db, now);
      const recovered = recoverCompeteSelections(state);
      const report = reconcileRuns(state.db, state.dataDir, now);
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
