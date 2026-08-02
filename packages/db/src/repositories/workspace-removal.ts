import { RUN_TERMINAL_STATES } from "@otomat/domain";
import { and, eq, inArray, notInArray, or, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import {
  agentSessions,
  competeGroups,
  eventStreams,
  issues,
  issueSources,
  linearIssueDrafts,
  linearWrites,
  projects,
  pullRequests,
  repositories,
  reviewComments,
  reviews,
  runContributions,
  runs,
  runtimeEvents,
  stepRuns,
  syncState,
  worktrees,
} from "../schema/index.js";

/** Gate for deletion: reads run status directly so corrupt plans cannot hide an active run. */
export function repositoryHasActiveRuns(db: Db, repositoryId: string): boolean {
  const row = db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(eq(runs.repository_id, repositoryId), notInArray(runs.status, [...RUN_TERMINAL_STATES])),
    )
    .limit(1)
    .get();
  return row !== undefined;
}

/**
 * Removes a registered repository and every row that depends on it — its runs
 * (with their steps, sessions, events, reviews, pull requests, and Linear
 * writes), its worktree rows, and the owning project with its issues and issue
 * sources when this was the project's only repository. Callers gate on
 * `repositoryHasActiveRuns`; the cascade assumes the repository is idle.
 * Disk artifacts (run event files, git worktree registrations) are not touched.
 */
export function deleteRepositoryCascade(db: Db, repositoryId: string): boolean {
  return db.transaction(
    (tx) => {
      const repository = tx
        .select()
        .from(repositories)
        .where(eq(repositories.id, repositoryId))
        .get();
      if (!repository) return false;
      const projectId = repository.project_id;

      const issueIds = tx
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.project_id, projectId))
        .all()
        .map((row) => row.id);
      const runFilters: SQL[] = [eq(runs.repository_id, repositoryId)];
      if (issueIds.length > 0) runFilters.push(inArray(runs.issue_id, issueIds));
      const runIds = tx
        .select({ id: runs.id })
        .from(runs)
        .where(or(...runFilters))
        .all()
        .map((row) => row.id);

      if (runIds.length > 0) {
        const reviewIds = tx
          .select({ id: reviews.id })
          .from(reviews)
          .where(inArray(reviews.run_id, runIds))
          .all()
          .map((row) => row.id);
        if (reviewIds.length > 0) {
          tx.delete(reviewComments).where(inArray(reviewComments.review_id, reviewIds)).run();
        }
        tx.delete(reviews).where(inArray(reviews.run_id, runIds)).run();
        tx.delete(pullRequests).where(inArray(pullRequests.run_id, runIds)).run();
        tx.delete(linearWrites).where(inArray(linearWrites.run_id, runIds)).run();
        tx.delete(runContributions).where(inArray(runContributions.run_id, runIds)).run();
        const stepRunIds = tx
          .select({ id: stepRuns.id })
          .from(stepRuns)
          .where(inArray(stepRuns.run_id, runIds))
          .all()
          .map((row) => row.id);
        if (stepRunIds.length > 0) {
          tx.delete(agentSessions).where(inArray(agentSessions.step_run_id, stepRunIds)).run();
        }
        tx.delete(stepRuns).where(inArray(stepRuns.run_id, runIds)).run();
        tx.delete(competeGroups).where(inArray(competeGroups.run_id, runIds)).run();
        tx.delete(runtimeEvents).where(inArray(runtimeEvents.run_id, runIds)).run();
        tx.delete(eventStreams).where(inArray(eventStreams.run_id, runIds)).run();
        tx.delete(runs).where(inArray(runs.id, runIds)).run();
      }

      tx.delete(worktrees).where(eq(worktrees.repository_id, repositoryId)).run();

      if (issueIds.length > 0) {
        tx.delete(linearIssueDrafts).where(inArray(linearIssueDrafts.issue_id, issueIds)).run();
        tx.delete(linearWrites).where(inArray(linearWrites.issue_id, issueIds)).run();
        tx.delete(issues).where(inArray(issues.id, issueIds)).run();
      }

      const sourceIds = tx
        .select({ id: issueSources.id })
        .from(issueSources)
        .where(eq(issueSources.project_id, projectId))
        .all()
        .map((row) => row.id);
      if (sourceIds.length > 0) {
        tx.delete(syncState).where(inArray(syncState.external_id, sourceIds)).run();
        tx.delete(issueSources).where(eq(issueSources.project_id, projectId)).run();
      }

      tx.delete(repositories).where(eq(repositories.id, repositoryId)).run();
      const remaining = tx
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.project_id, projectId))
        .limit(1)
        .get();
      if (!remaining) tx.delete(projects).where(eq(projects.id, projectId)).run();
      return true;
    },
    { behavior: "immediate" },
  );
}
