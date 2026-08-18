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
  WorkflowPresetRow,
} from "@otomat/db";
import { sqliteToIso } from "@otomat/db";
import {
  agentProfileContractSchema,
  agentSessionContractSchema,
  competeGroupContractSchema,
  issueContractSchema,
  projectContractSchema,
  isRunPlanCompeteGroup,
  pullRequestContractSchema,
  pullRequestEvidenceSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runContributionContractSchema,
  skillContractSchema,
  stepRunContractSchema,
  workflowPresetContractSchema,
  type AgentProfileContract,
  type AgentSessionContract,
  type CompeteGroupContract,
  type IssueContract,
  type IssueExecution,
  type IssueWorkspace,
  type ProjectContract,
  type PullRequestAttachment,
  type PullRequestContract,
  type RepositoryContract,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunContributionContract,
  type RunPlan,
  type SkillContract,
  type StepRunContract,
  type WorkflowPresetCompatibility,
  type WorkflowPresetContract,
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
  return agentSessionContractSchema.parse({
    ...row,
    boundary: {
      start_tree_sha: row.start_tree_sha,
      start_head_sha: row.start_head_sha,
      end_tree_sha: row.end_tree_sha,
      end_head_sha: row.end_head_sha,
      error: row.boundary_error,
    },
  });
}

export function toReview(row: ReviewRow): ReviewContract {
  return reviewContractSchema.parse(row);
}

export function toReviewComment(row: ReviewCommentRow): ReviewCommentContract {
  return reviewCommentContractSchema.parse(row);
}

/** A row carries its evidence as stored JSON; parsing it strictly means a corrupt audit is reported, never shown as "no evidence". */
function toAttachment(row: PullRequestRow): PullRequestAttachment | null {
  if (row.attached_at === null || row.attachment_evidence === null) return null;
  return {
    attached_at: row.attached_at,
    attached_by: row.attached_by,
    evidence: pullRequestEvidenceSchema.parse(JSON.parse(row.attachment_evidence)),
  };
}

export function toPullRequest(row: PullRequestRow): PullRequestContract {
  return pullRequestContractSchema.parse({
    id: row.id,
    issue_id: row.issue_id,
    run_id: row.run_id,
    provider: row.provider,
    origin: row.origin,
    provenance: row.provenance,
    author_login: row.author_login,
    review_decision: row.review_decision,
    checks_state: row.checks_state,
    mergeable: row.mergeable,
    requested_reviewers: row.requested_reviewers,
    provider_updated_at: row.provider_updated_at,
    head_sha: row.head_sha,
    attachment: toAttachment(row),
    number: row.number,
    url: row.url,
    status: row.status,
    publication_status: row.publication_status,
    title: row.title,
    body: row.body,
    head_ref: row.head_ref,
    base_ref: row.base_ref,
    commit_subject: row.commit_subject,
    commit_body: row.commit_body,
    generator:
      row.generator_runtime === null
        ? null
        : {
            runtime: row.generator_runtime,
            model: row.generator_model,
            effort: row.generator_effort,
          },
    published_head_sha: row.published_head_sha,
    published_diff_sha: row.published_diff_sha,
    error_code: row.error_code,
    error_message: row.error_message,
  });
}

/** Compatibility is resolved against this host, so it is passed in rather than read from the row. */
export function toWorkflowPreset(
  row: WorkflowPresetRow,
  compatibility: WorkflowPresetCompatibility,
): WorkflowPresetContract {
  return workflowPresetContractSchema.parse({
    id: row.id,
    name: row.name,
    scope: row.scope,
    project_id: row.project_id,
    plan: row.plan_json,
    compatibility,
  });
}
