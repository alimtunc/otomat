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
  RunContributionRow,
  RunRow,
  SkillRow,
  StepRunRow,
} from "@otomat/db";
import { sqliteToIso } from "@otomat/db";
import {
  agentProfileContractSchema,
  agentSessionContractSchema,
  competeGroupContractSchema,
  issueContractSchema,
  projectContractSchema,
  pullRequestContractSchema,
  isRunPlanCompeteGroup,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runContributionContractSchema,
  skillContractSchema,
  stepRunContractSchema,
  type AgentProfileContract,
  type AgentSessionContract,
  type CompeteGroupContract,
  type IssueContract,
  type IssueExecution,
  type IssueWorkspace,
  type ProjectContract,
  type PullRequestContract,
  type RepositoryContract,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunContributionContract,
  type RunPlan,
  type SkillContract,
  type StepRunContract,
  type WorktreeStatus,
} from "@otomat/domain";

export function toProject(row: ProjectRow, hasRepository: boolean): ProjectContract {
  return projectContractSchema.parse({ ...row, has_repository: hasRepository });
}

/** Maps a profile row to its wire contract, unwrapping the typed json columns. */
export function toAgentProfile(row: AgentProfileRow): AgentProfileContract {
  return agentProfileContractSchema.parse({
    id: row.id,
    name: row.name,
    runtime: row.runtime,
    options: row.options_json,
    model: row.model,
    guidance: row.guidance,
    skill_ids: row.skill_ids_json,
  });
}

export function toSkill(row: SkillRow): SkillContract {
  return skillContractSchema.parse(row);
}

export function toRepository(row: RepositoryRow, available: boolean): RepositoryContract {
  return repositoryContractSchema.parse({
    ...row,
    init_commands: row.init_commands_json,
    available,
  });
}

export function toIssue(
  row: IssueRow,
  execution: IssueExecution,
  workspace: IssueWorkspace,
): IssueContract {
  return issueContractSchema.parse({ ...row, execution, workspace });
}

function toIsoInstant(value: string | null): string | null {
  return value === null ? null : sqliteToIso(value);
}

const withoutContext = <T extends { context?: unknown }>({ context: _frozen, ...node }: T) => node;

/** A node's frozen context can be whole repository files, and a run row is re-read on every ledger event; the dossier endpoint serves it per session instead. */
function toPlanShape(plan: RunPlan): RunPlan {
  return {
    ...plan,
    steps: plan.steps.map((node) =>
      isRunPlanCompeteGroup(node)
        ? { ...node, compete: node.compete.map(withoutContext) }
        : withoutContext(node),
    ),
  };
}

export function toRun(row: RunRow): RunContract {
  return runContractSchema.parse({
    ...row,
    plan_json: toPlanShape(row.plan_json),
    updated_at: sqliteToIso(row.updated_at),
  });
}

export function toRunContribution(row: RunContributionRow): RunContributionContract {
  return runContributionContractSchema.parse({
    ...row,
    created_at: sqliteToIso(row.created_at),
    delivered_at: toIsoInstant(row.delivered_at),
    settled_at: toIsoInstant(row.settled_at),
  });
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

export function toPullRequest(row: PullRequestRow): PullRequestContract {
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
  });
}
