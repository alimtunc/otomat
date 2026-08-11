import { getIssue, getRun, type Db } from "@otomat/db";
import { isRunSettled, issueMachine, type LinearLifecycleSync } from "@otomat/domain";

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
  const issue = getIssue(config.db, run.issue_id);
  if (issue && !issueMachine.isTerminal(issue.status)) {
    driveIssueTo(config.db, issue.id, issue.status, "done");
    signalIssueLifecycle(config.syncIssueLifecycle, issue.id, "done", runId);
  }
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
