import type {
  AgentSessionRow,
  IssueRow,
  ProjectRow,
  RepositoryRow,
  RunRow,
  StepRunRow,
} from "@otomat/db";
import {
  agentSessionContractSchema,
  issueContractSchema,
  projectContractSchema,
  repositoryContractSchema,
  runContractSchema,
  stepRunContractSchema,
  type AgentSessionContract,
  type IssueContract,
  type ProjectContract,
  type RepositoryContract,
  type RunContract,
  type StepRunContract,
} from "@otomat/domain";

export function toProject(row: ProjectRow): ProjectContract {
  return projectContractSchema.parse({ id: row.id, name: row.name, root_path: row.root_path });
}

export function toRepository(row: RepositoryRow): RepositoryContract {
  return repositoryContractSchema.parse({
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    remote_url: row.remote_url,
    default_branch: row.default_branch,
  });
}

export function toIssue(row: IssueRow): IssueContract {
  return issueContractSchema.parse({
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    body: row.body,
    status: row.status,
    source: row.source,
    source_external_id: row.source_external_id,
    synced_at: row.synced_at,
  });
}

export function toRun(row: RunRow): RunContract {
  return runContractSchema.parse({
    id: row.id,
    issue_id: row.issue_id,
    status: row.status,
    branch: row.branch,
    plan_json: row.plan_json,
  });
}

export function toStepRun(row: StepRunRow): StepRunContract {
  return stepRunContractSchema.parse({
    id: row.id,
    run_id: row.run_id,
    idx: row.idx,
    name: row.name,
    status: row.status,
  });
}

export function toAgentSession(row: AgentSessionRow): AgentSessionContract {
  return agentSessionContractSchema.parse({
    id: row.id,
    step_run_id: row.step_run_id,
    agent_id: row.agent_id,
    status: row.status,
    provider_session_id: row.provider_session_id,
  });
}
