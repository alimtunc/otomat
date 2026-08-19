import { getRun, listStepRunsForRun, markRunAbandoned, type RunRow } from "@otomat/db";
import { isRunSettled, type WorkspaceAbandonBlocker } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { buildAbandonedEvent } from "./markers.js";
import { requireRunRow } from "./resume.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveIdleRunTo } from "./transitions.js";
import { holdsOpenWorkspace, issueWorkspace } from "./workspace.js";

const BLOCKER_MESSAGES = {
  workspace_closed: "this run no longer holds its issue's workspace",
  run_active: "cancel the run before abandoning its workspace",
} satisfies Record<WorkspaceAbandonBlocker, string>;

/** Abandon refused, carrying the wire code the API returns verbatim. */
export class WorkspaceAbandonRefusedError extends Error {
  constructor(
    readonly code: WorkspaceAbandonBlocker,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceAbandonRefusedError";
  }
}

/** Why abandoning this run's workspace is refused right now, or null when the confirmation may proceed. */
export function abandonBlocker(
  state: SupervisorState,
  run: RunRow,
): WorkspaceAbandonBlocker | null {
  const workspace = issueWorkspace(state.db, run.issue_id);
  if (!holdsOpenWorkspace(workspace, run.id)) return "workspace_closed";
  if (workspace.busy || hasRunActivity(state, run.id)) return "run_active";
  return null;
}

/** The only manual end of an issue's work cycle: stops the plan and stamps the run, deleting no branch, worktree or commit. */
export function abandonWorkspace(state: SupervisorState, runId: string): RunRow {
  const run = getRun(state.db, runId);
  if (!run) {
    throw new WorkspaceAbandonRefusedError("workspace_closed", `run ${runId} not found`);
  }
  const blocker = abandonBlocker(state, run);
  if (blocker) throw new WorkspaceAbandonRefusedError(blocker, BLOCKER_MESSAGES[blocker]);

  const now = new Date().toISOString();
  if (!isRunSettled(run.status)) {
    driveIdleRunTo(state.db, run, "canceled", listStepRunsForRun(state.db, runId), now);
  }
  markRunAbandoned(state.db, runId, now);
  emitLedgerEvent(state.db, state.dataDir, runId, buildAbandonedEvent(runId, run.branch, now));
  return requireRunRow(state.db, runId, "abandon");
}
