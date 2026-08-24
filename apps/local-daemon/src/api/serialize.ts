import type {
  AgentProfileRow,
  AgentSessionRow,
  CompeteGroupRow,
  IssueRow,
  ProjectRow,
  ReviewCommentRow,
  ReviewedFileRow,
  ReviewRow,
  RunContributionRow,
  RunInteractionRow,
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
  reviewCommentContractSchema,
  reviewContractSchema,
  reviewedFileContractSchema,
  runContractSchema,
  runContributionContractSchema,
  runInteractionContractSchema,
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
  type ReviewCommentContract,
  type ReviewContract,
  type ReviewedFileContract,
  type RunContract,
  type RunContributionContract,
  type RunInteractionContract,
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
    target_config: row.target_config_json,
    created_at: sqliteToIso(row.created_at),
    delivered_at: toIsoInstant(row.delivered_at),
    settled_at: toIsoInstant(row.settled_at),
  });
}

export function toRunInteraction(row: RunInteractionRow): RunInteractionContract {
  return runInteractionContractSchema.parse({
    ...row,
    options: row.options_json,
    answer: row.answer_json,
    requested_at: sqliteToIso(row.requested_at),
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
    provider_wait: row.status === "waiting_for_provider" ? row.provider_wait_json : null,
    next_turn_config: row.next_turn_config_json,
  });
}

export function toCompeteGroup(row: CompeteGroupRow): CompeteGroupContract {
  return competeGroupContractSchema.parse(row);
}

export function toAgentSession(row: AgentSessionRow): AgentSessionContract {
  return agentSessionContractSchema.parse({
    ...row,
    config: row.config_json,
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

export function toReviewedFile(row: ReviewedFileRow): ReviewedFileContract {
  return reviewedFileContractSchema.parse(row);
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
