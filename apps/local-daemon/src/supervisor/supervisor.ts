import { abandonWorkspace } from "./abandon.js";
import { abortRun } from "./abort.js";
import { advanceRun } from "./advance.js";
import { appendRunStep } from "./append-step.js";
import { agentCapacity, runWait, setAgentCapacity } from "./capacity.js";
import { resumeRun, startRun } from "./commands.js";
import {
  cancelRunContribution,
  cancelUndeliverableContributions,
  contributeToRun,
  deliverQueuedContributions,
  reconcileContributionClaims,
  retryRunContribution,
} from "./contribution/index.js";
import { finishSettle } from "./pass-boundary.js";
import { terminateGracefully } from "./process.js";
import { recoverCompeteSelections, selectCompeteWinner } from "./promotion.js";
import { reconcileRuns } from "./reconcile.js";
import { runResumePlan } from "./resume-plan.js";
import { createState } from "./state.js";
import type { Supervisor, SupervisorConfig } from "./types.js";
import { workspaceClosureFacts } from "./workspace-summary.js";

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const state = createState(config);
  state.advance = async (runId) => {
    await advanceRun(state, runId);
    await deliverQueuedContributions(state, runId);
    cancelUndeliverableContributions(state, runId);
  };
  return {
    start: (request) => startRun(state, request),
    waitFor: (runId) => runWait(state, runId),
    capacity: () => agentCapacity(state),
    setCapacity: (maxConcurrentSessions) => setAgentCapacity(state, maxConcurrentSessions),
    resume: (runId) => resumeRun(state, runId),
    resumePlan: (runId) => runResumePlan(state, runId),
    abandon: (runId) => abandonWorkspace(state, runId),
    workspaceClosure: (runId) => workspaceClosureFacts(state, runId),
    appendStep: (runId, input) => appendRunStep(state, runId, input),
    contribute: (runId, stepRunId, body) => contributeToRun(state, runId, stepRunId, body),
    retryContribution: (runId, contributionId) =>
      retryRunContribution(state, runId, contributionId),
    cancelContribution: (runId, contributionId) =>
      cancelRunContribution(state, runId, contributionId),
    deliverContributions: (runId) => deliverQueuedContributions(state, runId),
    selectWinner: (runId, groupId, stepRunId) =>
      selectCompeteWinner(state, runId, groupId, stepRunId),
    abort: (runId) => abortRun(state, runId),
    reconcile: () => {
      const now = new Date().toISOString();
      reconcileContributionClaims(state.db, state.dataDir, now);
      const recovered = recoverCompeteSelections(state);
      const report = reconcileRuns(state.db, state.dataDir, now);
      const reconciled = [...recovered, ...report.reconciled];
      for (const outcome of reconciled) finishSettle(state, outcome);
      return { reconciled };
    },
    settle: async () => {
      while (state.inflight.size > 0 || state.pending.size > 0) {
        await Promise.all([
          ...[...state.inflight.values()].map((handle) => handle.monitor),
          ...state.pending,
        ]);
      }
    },
    shutdown: async (graceMs) => {
      state.shuttingDown = true;
      for (const controllers of state.initInterrupts.values()) {
        for (const controller of controllers) controller.abort();
      }
      for (const sessionId of state.slots.queued()) state.slots.cancel(sessionId);
      await Promise.all(
        [...state.starting.values(), ...state.inflight.values()].map((handle) =>
          terminateGracefully(handle.proc, graceMs),
        ),
      );
      await Promise.all(state.pending);
    },
  };
}
