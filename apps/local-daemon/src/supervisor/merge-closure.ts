import { getIssue, getRun, type Db } from "@otomat/db";
import { isRunTerminal, issueMachine } from "@otomat/domain";

import { WorktreeNotFoundError, type RepositoryResolver } from "#git";

import { driveIssueTo, driveRunTo } from "./transitions.js";

export interface MergeClosureConfig {
  db: Db;
  repositories: RepositoryResolver;
}

/** Discarding the worktree and its local branch is safe because the merge is upstream already. */
export function closeMergedRun(config: MergeClosureConfig, runId: string): void {
  const run = getRun(config.db, runId);
  if (!run) return;
  releaseWorktree(config, runId);
  // A run left at `review_ready` still projects as `reviewing`, which would drag the merged
  // issue's card back a column and keep publish and fix offered on work that already shipped.
  if (!isRunTerminal(run.status)) {
    driveRunTo(config.db, runId, run.status, "completed", new Date().toISOString());
  }
  const issue = getIssue(config.db, run.issue_id);
  // A terminal issue keeps the state its user chose; `done` is what later refuses a resume.
  if (issue && !issueMachine.isTerminal(issue.status)) {
    driveIssueTo(config.db, issue.id, issue.status, "done");
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
