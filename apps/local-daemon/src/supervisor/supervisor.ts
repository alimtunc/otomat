import { abortRun } from "./abort.js";
import { fixRun, followUpRun, resumeRun, startRun } from "./commands.js";
import { reconcileRuns } from "./reconcile.js";
import { createState, notifyAfterSettle } from "./state.js";
import type { Supervisor, SupervisorConfig } from "./types.js";

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const state = createState(config);
  return {
    start: (request) => startRun(state, request),
    resume: (runId) => resumeRun(state, runId),
    fix: (runId, prompt) => fixRun(state, runId, prompt),
    followUp: (runId, prompt) => followUpRun(state, runId, prompt),
    abort: (runId) => abortRun(state, runId),
    reconcile: () => {
      const report = reconcileRuns(state.db, state.dataDir, new Date().toISOString());
      for (const outcome of report.reconciled) notifyAfterSettle(state, outcome);
      return report;
    },
    settle: async () => {
      await Promise.all([...state.inflight.values()].map((handle) => handle.monitor));
    },
  };
}
