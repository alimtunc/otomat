import type { Db } from "@otomat/db";

import type { RepositoryResolver } from "#git";

import { hasRunActivity, type SupervisorState } from "../state.js";

export interface WorkspaceContext {
  db: Db;
  dataDir: string;
  repositories: RepositoryResolver;
  /** A caller outside the supervisor answers `false` and leans on the recorded sessions instead. */
  busyRuns(runId: string): boolean;
  /** `null` where no reconciliation runs. */
  refreshPullRequests: (() => Promise<number>) | null;
}

export function supervisorWorkspaces(state: SupervisorState): WorkspaceContext {
  return {
    db: state.db,
    dataDir: state.dataDir,
    repositories: state.repositories,
    busyRuns: (runId) => hasRunActivity(state, runId),
    refreshPullRequests: state.refreshPullRequests,
  };
}
