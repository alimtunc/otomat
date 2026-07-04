import { abortRun } from "./abort.js";
import { resumeRun, startRun } from "./commands.js";
import { reconcileRuns } from "./reconcile.js";
import { createState } from "./state.js";
import type { Supervisor, SupervisorConfig } from "./types.js";

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const state = createState(config);
  return {
    start: (request) => startRun(state, request),
    resume: (runId) => resumeRun(state, runId),
    abort: (runId) => abortRun(state, runId),
    reconcile: () => reconcileRuns(state.db, state.dataDir, new Date().toISOString()),
    settle: async () => {
      await Promise.all([...state.inflight.values()].map((handle) => handle.monitor));
    },
  };
}
