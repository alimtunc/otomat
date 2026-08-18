import { getIssue, getRun, listIssueExecutionEvidence, type Db } from "@otomat/db";
import {
  isRunSettled,
  issueMachine,
  projectIssueWorkspace,
  type LinearLifecycleSync,
} from "@otomat/domain";

import { WorktreeNotFoundError, type RepositoryResolver } from "#git";

import { signalIssueLifecycle } from "./issue-lifecycle.js";
import { driveIssueTo, driveRunTo } from "./transitions.js";

export interface MergeClosureConfig {
  db: Db;
  repositories: RepositoryResolver;
  /** A confirmed merge is the only thing that closes the tracker issue; every other outcome leaves it open. */
  syncIssueLifecycle?: LinearLifecycleSync;
}

/** Discarding the worktree and its local branch is safe because the merge is upstream already. */
export function closeMergedRun(config: MergeClosureConfig, runId: string): void {
  const run = getRun(config.db, runId);
  if (!run) return;
  releaseWorktree(config, runId);
  if (!isRunSettled(run.status)) {
    driveRunTo(config.db, runId, run.status, "completed", new Date().toISOString());
  }
  markIssueDone(config, run.issue_id, runId);
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

/** A failed cleanup must not fail the read that observed the merge; it stays visible in the log. */
function releaseWorktree(config: MergeClosureConfig, runId: string): void {
  const service = config.repositories.forRun(runId)?.service;
  if (!service) return;
  try {
    service.cleanup(runId);
  } catch (error) {
    if (error instanceof WorktreeNotFoundError) return;
    console.error(`[otomat] worktree cleanup for merged run ${runId} failed`, error);
  }
}
