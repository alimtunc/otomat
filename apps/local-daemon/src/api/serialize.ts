import type {
  AgentProfileRow,
  AgentSessionRow,
  CompeteGroupRow,
  IssueRow,
  ProjectRow,
  PullRequestRow,
  RepositoryRow,
  ReviewCommentRow,
  ReviewRow,
  RunRow,
  SkillRow,
  StepRunRow,
} from "@otomat/db";
import {
  agentProfileContractSchema,
  agentSessionContractSchema,
  competeGroupContractSchema,
  issueContractSchema,
  projectContractSchema,
  pullRequestContractSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runDiffResponseSchema,
  skillContractSchema,
  stepRunContractSchema,
  type AgentProfileContract,
  type AgentSessionContract,
  type CompeteGroupContract,
  type IssueContract,
  type ProjectContract,
  type PullRequestContract,
  type RepositoryContract,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunDiffResponse,
  type SkillContract,
  type StepRunContract,
  type WorktreeStatus,
} from "@otomat/domain";

import type { RunDiffResult } from "#review";

export function toProject(row: ProjectRow): ProjectContract {
  return projectContractSchema.parse(row);
}

/** Maps a profile row to its wire contract, unwrapping the typed json columns. */
export function toAgentProfile(row: AgentProfileRow): AgentProfileContract {
  return agentProfileContractSchema.parse({
    id: row.id,
    name: row.name,
    runtime: row.runtime,
    options: row.options_json,
    guidance: row.guidance,
    skill_ids: row.skill_ids_json,
  });
}

export function toSkill(row: SkillRow): SkillContract {
  return skillContractSchema.parse(row);
}

export function toRepository(row: RepositoryRow): RepositoryContract {
  return repositoryContractSchema.parse(row);
}

export function toIssue(row: IssueRow): IssueContract {
  return issueContractSchema.parse(row);
}

export function toRun(row: RunRow): RunContract {
  return runContractSchema.parse(row);
}

/** A compete candidate carries the branch and status of its own isolated worktree; a plain step has none. */
export function toStepRun(
  row: StepRunRow,
  worktree?: { branch: string; status: WorktreeStatus },
): StepRunContract {
  return stepRunContractSchema.parse({
    ...row,
    branch: worktree?.branch ?? null,
    worktree_status: worktree?.status ?? null,
  });
}

export function toCompeteGroup(row: CompeteGroupRow): CompeteGroupContract {
  return competeGroupContractSchema.parse(row);
}

export function toAgentSession(row: AgentSessionRow): AgentSessionContract {
  return agentSessionContractSchema.parse(row);
}

export function toReview(row: ReviewRow): ReviewContract {
  return reviewContractSchema.parse(row);
}

export function toReviewComment(row: ReviewCommentRow): ReviewCommentContract {
  return reviewCommentContractSchema.parse(row);
}

export function toPullRequest(
  row: PullRequestRow,
  hasUnpublishedChanges: boolean | null,
): PullRequestContract {
  return pullRequestContractSchema.parse({
    id: row.id,
    run_id: row.run_id,
    provider: row.provider,
    number: row.number,
    url: row.url,
    status: row.status,
    publication_status: row.publication_status,
    title: row.title,
    body: row.body,
    head_ref: row.head_ref,
    base_ref: row.base_ref,
    published_head_sha: row.published_head_sha,
    published_diff_sha: row.published_diff_sha,
    error_code: row.error_code,
    error_message: row.error_message,
    has_unpublished_changes: hasUnpublishedChanges,
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
