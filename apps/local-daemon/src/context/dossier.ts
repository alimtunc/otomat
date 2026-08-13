import {
  getPullRequestForRun,
  listStepRunsForRun,
  type Db,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import type { ContextSelection, SessionContext } from "@otomat/domain";

import { readStepMessages } from "#events";
import type { RepositoryResolver } from "#git";

import { isDependencyStep, planDependencyIds, progressContext, stepReport } from "./progress.js";
import { pullRequestContext, workspaceContext } from "./workspace.js";

/** Enough of a step's tail to find its last spoken message past a run of reasoning frames. */
const STEP_MESSAGE_LOOKBACK = 50;

export interface SessionContextInput {
  db: Db;
  repositories: RepositoryResolver;
  run: RunRow;
  stepRunId: string;
  /** What the plan froze for this step; null on runs launched before the declarative model. */
  selection: ContextSelection | null;
  capturedAt: string;
}

function emptySelection(capturedAt: string): ContextSelection {
  return {
    captured_at: capturedAt,
    issue: null,
    issues: [],
    files: [],
    review_comments: [],
    note: null,
  };
}

function dependencyReports(
  db: Db,
  runId: string,
  steps: readonly StepRunRow[],
  dependencies: ReadonlySet<string>,
): Map<string, string> {
  const reports = new Map<string, string>();
  for (const step of steps) {
    if (!isDependencyStep(step, dependencies)) continue;
    const report = stepReport(readStepMessages(db, runId, step.id, STEP_MESSAGE_LOOKBACK));
    if (report !== null) reports.set(step.id, report);
  }
  return reports;
}

export function buildSessionContext(input: SessionContextInput): SessionContext {
  const { db, run, stepRunId } = input;
  const binding = input.repositories.forRepository(run.repository_id);
  const steps = listStepRunsForRun(db, run.id);
  const dependencies = planDependencyIds(run.plan_json, stepRunId);
  // A compete candidate holds its own worktree; every other step works in the run's.
  const owner = steps.find((step) => step.id === stepRunId)?.worktree_id ? stepRunId : run.id;
  const pullRequest = getPullRequestForRun(db, run.id);
  return {
    version: 1,
    captured_at: input.capturedAt,
    selection: input.selection ?? emptySelection(input.capturedAt),
    workspace: workspaceContext({ run, binding, owner }),
    pull_request: pullRequest === undefined ? null : pullRequestContext(pullRequest),
    progress: progressContext({
      steps,
      stepRunId,
      dependencies,
      reports: dependencyReports(db, run.id, steps, dependencies),
    }),
  };
}
