import { getIssue, getRun, type Db } from "@otomat/db";
import { issueMachine } from "@otomat/domain";

import { WorktreeNotFoundError, type RepositoryResolver } from "#git";

import { driveIssueTo } from "./transitions.js";

export interface MergeClosureConfig {
  db: Db;
  repositories: RepositoryResolver;
}

/**
 * What a merged pull request settles, in one event: the run's worktree and its local
 * `otomat/run/*` branch go (the merge is upstream now, so nothing is lost), and the issue lands
 * on `done`. Pull-based by design — only an explicit read of a run's PR panel gets here, never a
 * scheduler — and idempotent: a run whose worktree is already gone, or an issue already terminal,
 * is left alone.
 */
export function closeMergedRun(config: MergeClosureConfig, runId: string): void {
  const run = getRun(config.db, runId);
  if (!run) return;
  releaseWorktree(config, runId);
  const issue = getIssue(config.db, run.issue_id);
  // `done` is terminal: from here a resume or a relaunch is refused by the machine, which is the
  // point — the work shipped. A canceled issue is terminal too and keeps the state its user chose.
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
