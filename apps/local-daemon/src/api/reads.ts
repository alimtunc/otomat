import {
  getAgentProfile,
  getCompeteGroup,
  getIssue,
  getRun,
  getStepRun,
  listAgentProfiles,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listIssueExecutionEvidence,
  listIssues,
  listProjects,
  listRepositories,
  listRuns,
  listSkills,
  listStepRunsForRun,
  type Db,
  type IssueExecutionEvidenceRow,
  type StepRunRow,
} from "@otomat/db";
import {
  projectIssueExecution,
  type AgentProfileContract,
  type IssueContract,
  type IssueExecutionEvidence,
  type ProjectContract,
  type RepositoryContract,
  type RunContract,
  type RunDetail,
  type SkillContract,
} from "@otomat/domain";

import { findWorktreeById } from "#git/worktrees-store";

import {
  toAgentProfile,
  toAgentSession,
  toCompeteGroup,
  toIssue,
  toProject,
  toRepository,
  toRun,
  toSkill,
  toStepRun,
} from "./serialize.js";

export function readProjects(db: Db): ProjectContract[] {
  return listProjects(db).map(toProject);
}

export function readAgentProfiles(db: Db): AgentProfileContract[] {
  return listAgentProfiles(db).map(toAgentProfile);
}

export function readAgentProfile(db: Db, id: string): AgentProfileContract | null {
  const row = getAgentProfile(db, id);
  return row ? toAgentProfile(row) : null;
}

export function readSkills(db: Db): SkillContract[] {
  return listSkills(db).map(toSkill);
}

export function readRepositories(db: Db, projectId?: string): RepositoryContract[] {
  return listRepositories(db, { projectId }).map(toRepository);
}

/** Groups the flat evidence rows by issue so each issue gets one deterministic projection. */
function groupExecutionEvidence(
  rows: IssueExecutionEvidenceRow[],
): Map<string, IssueExecutionEvidence[]> {
  const byIssue = new Map<string, IssueExecutionEvidence[]>();
  for (const { issue_id, ...evidence } of rows) {
    const bucket = byIssue.get(issue_id);
    if (bucket) bucket.push(evidence);
    else byIssue.set(issue_id, [evidence]);
  }
  return byIssue;
}

export function readIssues(db: Db, projectId?: string): IssueContract[] {
  const evidence = groupExecutionEvidence(listIssueExecutionEvidence(db, { projectId }));
  return listIssues(db, { projectId }).map((row) =>
    toIssue(row, projectIssueExecution(evidence.get(row.id) ?? [])),
  );
}

export function readIssue(db: Db, id: string): IssueContract | null {
  const row = getIssue(db, id);
  if (!row) return null;
  return toIssue(row, projectIssueExecution(listIssueExecutionEvidence(db, { issueId: id })));
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
    steps: listStepRunsForRun(db, runId).map((step) =>
      toStepRun(step, step.worktree_id ? findWorktreeById(db, step.worktree_id) : undefined),
    ),
    sessions: listAgentSessionsForRun(db, runId).map(toAgentSession),
    compete_groups: listCompeteGroupsForRun(db, runId).map(toCompeteGroup),
    worktree_path: worktree?.path ?? null,
  };
}

/** The candidate step of one compete group, or null when either id does not belong to the run. */
export function readCompeteCandidate(
  db: Db,
  runId: string,
  groupId: string,
  stepId: string,
): StepRunRow | null {
  const group = getCompeteGroup(db, groupId);
  if (!group || group.run_id !== runId) return null;
  const step = getStepRun(db, stepId);
  return step && step.compete_group_id === group.id ? step : null;
}
