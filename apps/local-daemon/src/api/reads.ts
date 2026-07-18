import {
  getIssue,
  getRun,
  listAgentSessionsForRun,
  listIssues,
  listProjects,
  listRepositories,
  listRuns,
  listStepRunsForRun,
  type Db,
} from "@otomat/db";
import {
  type IssueContract,
  type ProjectContract,
  type RepositoryContract,
  type RunContract,
  type RunDetail,
} from "@otomat/domain";

import { findWorktreeById } from "#git/worktrees-store";

import { toAgentSession, toIssue, toProject, toRepository, toRun, toStepRun } from "./serialize.js";

export function readProjects(db: Db): ProjectContract[] {
  return listProjects(db).map(toProject);
}

export function readRepositories(db: Db, projectId?: string): RepositoryContract[] {
  return listRepositories(db, { projectId }).map(toRepository);
}

export function readIssues(db: Db, projectId?: string): IssueContract[] {
  return listIssues(db, { projectId }).map(toIssue);
}

export function readIssue(db: Db, id: string): IssueContract | null {
  const row = getIssue(db, id);
  return row ? toIssue(row) : null;
}

export function readRuns(
  db: Db,
  options: { issueId?: string; projectId?: string } = {},
): RunContract[] {
  return listRuns(db, options).map(toRun);
}

export function readRunDetail(db: Db, runId: string): RunDetail | null {
  const run = getRun(db, runId);
  if (!run) return null;
  const worktree = run.worktree_id ? findWorktreeById(db, run.worktree_id) : undefined;
  return {
    run: toRun(run),
    steps: listStepRunsForRun(db, runId).map(toStepRun),
    sessions: listAgentSessionsForRun(db, runId).map(toAgentSession),
    worktree_path: worktree?.path ?? null,
  };
}
