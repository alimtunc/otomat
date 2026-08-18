import {
  getIssue,
  getRun,
  listIssueExecutionEvidence,
  readAutoDeleteWorkspaces,
  type Db,
} from "@otomat/db";
import {
  isRunSettled,
  issueMachine,
  projectIssueWorkspace,
  type LinearLifecycleSync,
} from "@otomat/domain";

import type { RepositoryResolver } from "#git";

import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { driveIssueTo, driveRunTo } from "./transitions.js";
import { cleanupWorkspace, cycleHolders, findWorkspaceEntry } from "./workspaces/index.js";

export interface MergeClosureConfig {
  db: Db;
  dataDir: string;
  repositories: RepositoryResolver;
  /** A confirmed merge is the only thing that closes the tracker issue; every other outcome leaves it open. */
  syncIssueLifecycle?: LinearLifecycleSync;
}

/** The cycle closes first, so the workspace it leaves behind is already read as closed. */
export function closeMergedRun(config: MergeClosureConfig, runId: string): void {
  const run = getRun(config.db, runId);
  if (!run) return;
  if (!isRunSettled(run.status)) {
    driveRunTo(config.db, runId, run.status, "completed", new Date().toISOString());
  }
  markIssueDone(config, run.issue_id, runId);
  releaseWorkspace(config, run.worktree_id);
}

/** A merge Otomat only witnessed closes the cycle like one it made: through the canonical run, or on the issue when none ran here. */
export function closeMergedIssue(config: MergeClosureConfig, issueId: string): void {
  const workspace = projectIssueWorkspace(listIssueExecutionEvidence(config.db, { issueId }));
  if (workspace.state === "open") {
    closeMergedRun(config, workspace.run_id);
    return;
  }
  markIssueDone(config, issueId, null);
}

function markIssueDone(config: MergeClosureConfig, issueId: string, runId: string | null): void {
  const issue = getIssue(config.db, issueId);
  if (!issue || issueMachine.isTerminal(issue.status)) return;
  driveIssueTo(config.db, issue.id, issue.status, "done");
  signalIssueLifecycle(config.syncIssueLifecycle, issue.id, "done", runId);
}

/** Anything refused here leaves the workspace for the next reconciliation or a manual action. */
function releaseWorkspace(config: MergeClosureConfig, worktreeId: string | null): void {
  if (worktreeId === null || !readAutoDeleteWorkspaces(config.db)) return;
  const context = {
    db: config.db,
    dataDir: config.dataDir,
    repositories: config.repositories,
    busyRuns: () => false,
    refreshPullRequests: null,
  };
  const entry = findWorkspaceEntry(context, worktreeId, cycleHolders(config.db));
  if (entry === null) return;
  const result = cleanupWorkspace(context, entry);
  if (result.outcome !== "cleaned") {
    console.error(
      `[otomat] workspace ${worktreeId} kept after merge (${result.outcome}): ${result.message}`,
    );
  }
}
