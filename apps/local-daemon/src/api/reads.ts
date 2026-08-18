import {
  getAgentProfile,
  getCompeteGroup,
  getIssue,
  getRun,
  getStepRun,
  getWorkflowPreset,
  listAgentProfiles,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listIssueExecutionEvidence,
  listIssues,
  listProjects,
  listRepositories,
  listRunContributions,
  listRuns,
  listSkills,
  listStepRunsForRun,
  listWorkflowPresets,
  getProject,
  type Db,
  type IssueExecutionEvidenceRow,
  type StepRunRow,
} from "@otomat/db";
import {
  isRunSettled,
  isStepSettled,
  projectIssueExecution,
  projectIssueWorkspace,
  runUsageResponseSchema,
  scopeUsage,
  stepUsage,
  type AgentProfileContract,
  type IssueContract,
  type IssueExecutionEvidence,
  type ProjectContract,
  type RepositoryContract,
  type RunContract,
  type RunContributionsResponse,
  type RunDetail,
  type RunResumePlan,
  type RunState,
  type RunUsageResponse,
  type RunWait,
  type SkillContract,
  type WorkflowPresetContract,
} from "@otomat/domain";

import { workflowPresetCompatibility } from "#agents";
import { readRunEvents } from "#events";
import { isRepositoryRoot } from "#git";
import { findWorktreeById } from "#git/worktrees-store";

import { toReportedUsage } from "./serialize-usage.js";
import {
  toAgentProfile,
  toAgentSession,
  toCompeteGroup,
  toIssue,
  toProject,
  toRepository,
  toRun,
  toRunContribution,
  toSkill,
  toStepRun,
  toWorkflowPreset,
} from "./serialize.js";

export function readProjects(db: Db): ProjectContract[] {
  const withRepository = new Set(listRepositories(db).map((row) => row.project_id));
  return listProjects(db).map((row) => toProject(row, withRepository.has(row.id)));
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

/** Compatibility is re-resolved on every read: a profile, skill or runtime can leave this host at any time. */
export function readWorkflowPresets(db: Db, projectId?: string): WorkflowPresetContract[] {
  return listWorkflowPresets(db, { projectId }).map((row) =>
    toWorkflowPreset(row, workflowPresetCompatibility(db, row.plan_json)),
  );
}

export function readWorkflowPreset(db: Db, id: string): WorkflowPresetContract | null {
  const row = getWorkflowPreset(db, id);
  return row ? toWorkflowPreset(row, workflowPresetCompatibility(db, row.plan_json)) : null;
}

/** Probed per read so a root that moved or stopped being a git repository is never offered as a launch target. */
export function readRepositories(db: Db, projectId?: string): RepositoryContract[] {
  return listRepositories(db, { projectId }).map((row) => {
    const project = getProject(db, row.project_id);
    return toRepository(row, project !== undefined && isRepositoryRoot(project.root_path));
  });
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
  return listIssues(db, { projectId }).map((row) => {
    const rows = evidence.get(row.id) ?? [];
    return toIssue(row, projectIssueExecution(rows), projectIssueWorkspace(rows));
  });
}

export function readIssue(db: Db, id: string): IssueContract | null {
  const row = getIssue(db, id);
  if (!row) return null;
  const evidence = listIssueExecutionEvidence(db, { issueId: id });
  return toIssue(row, projectIssueExecution(evidence), projectIssueWorkspace(evidence));
}

export function readRuns(
  db: Db,
  options: { issueId?: string; projectId?: string } = {},
): RunContract[] {
  return listRuns(db, options).map(toRun);
}

/** The live view of one run: `wait` and `resume` come from the scheduler rather than the rows, so a `queued` run says what it waits on and a stopped one says what resuming it would do. */
export function readRunDetail(
  db: Db,
  runId: string,
  live: { wait: RunWait | null; resume: RunResumePlan },
): RunDetail | null {
  const run = getRun(db, runId);
  if (!run) return null;
  const worktree = run.worktree_id ? findWorktreeById(db, run.worktree_id) : undefined;
  const evidence = listIssueExecutionEvidence(db, { issueId: run.issue_id });
  const workspace = projectIssueWorkspace(evidence);
  return {
    run: toRun(run),
    steps: listStepRunsForRun(db, runId).map((step) =>
      toStepRun(step, step.worktree_id ? findWorktreeById(db, step.worktree_id) : undefined),
    ),
    sessions: listAgentSessionsForRun(db, runId).map(toAgentSession),
    compete_groups: listCompeteGroupsForRun(db, runId).map(toCompeteGroup),
    worktree_path: worktree?.path ?? null,
    base_branch:
      worktree?.base_ref === undefined || worktree.base_ref === "" ? null : worktree.base_ref,
    wait: live.wait,
    resume: live.resume,
    holds_workspace: workspace.state === "open" && workspace.run_id === runId,
  };
}

export function readRunContributions(db: Db, runId: string): RunContributionsResponse {
  return { run_id: runId, contributions: listRunContributions(db, runId).map(toRunContribution) };
}

/** Read from the whole ledger, so a cockpit that has paged only the newest events still sees a true total. */
export function readRunUsage(db: Db, run: { id: string; status: RunState }): RunUsageResponse {
  const events = readRunEvents(db, run.id);
  return runUsageResponseSchema.parse({
    run_id: run.id,
    total: toReportedUsage(scopeUsage(events, isRunSettled(run.status))),
    steps: listStepRunsForRun(db, run.id).map((step) => ({
      step_run_id: step.id,
      name: step.name,
      status: step.status,
      usage: toReportedUsage(stepUsage(events, step.id, isStepSettled(step.status))),
    })),
  });
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
