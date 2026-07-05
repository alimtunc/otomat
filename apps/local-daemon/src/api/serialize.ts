import type {
  AgentSessionRow,
  IssueRow,
  ProjectRow,
  PullRequestRow,
  RepositoryRow,
  ReviewCommentRow,
  ReviewRow,
  RunRow,
  StepRunRow,
} from "@otomat/db";
import {
  agentSessionContractSchema,
  issueContractSchema,
  projectContractSchema,
  pullRequestContractSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runDiffResponseSchema,
  stepRunContractSchema,
  type AgentSessionContract,
  type IssueContract,
  type ProjectContract,
  type PullRequestContract,
  type RepositoryContract,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunDiffResponse,
  type StepRunContract,
} from "@otomat/domain";

import type { RunDiffResult } from "#review";

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

export function toReview(row: ReviewRow): ReviewContract {
  return reviewContractSchema.parse({ id: row.id, run_id: row.run_id, status: row.status });
}

export function toReviewComment(row: ReviewCommentRow): ReviewCommentContract {
  return reviewCommentContractSchema.parse({
    id: row.id,
    review_id: row.review_id,
    file_path: row.file_path,
    line: row.line,
    diff_sha: row.diff_sha,
    body: row.body,
    status: row.status,
    hunk_snapshot: row.hunk_snapshot,
    fix_requested_at: row.fix_requested_at,
  });
}

export function toPullRequest(row: PullRequestRow): PullRequestContract {
  return pullRequestContractSchema.parse({
    id: row.id,
    run_id: row.run_id,
    provider: row.provider,
    number: row.number,
    url: row.url,
    status: row.status,
    title: row.title,
    body: row.body,
  });
}

/** Maps a `RunDiffResult` to its wire contract, remapping camelCase fields to snake_case; `diff` is null when the result carries no computed diff. */
export function toRunDiffResponse(runId: string, result: RunDiffResult): RunDiffResponse {
  const diff = result.diff;
  return runDiffResponseSchema.parse({
    run_id: runId,
    computed_at: result.computedAt,
    diff: diff
      ? {
          base: diff.base,
          additions: diff.additions,
          deletions: diff.deletions,
          sha: diff.sha,
          files: diff.files.map((file) => ({
            path: file.path,
            old_path: file.oldPath,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            binary: file.binary,
            patch: file.patch,
            sha: file.sha,
          })),
        }
      : null,
  });
}
