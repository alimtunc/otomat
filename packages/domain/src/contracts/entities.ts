import { z } from "zod";

import { AGENT_SESSION_STATES } from "../state-machines/agent-session.js";
import { COMPETE_GROUP_STATES } from "../state-machines/compete-group.js";
import { ISSUE_STATES } from "../state-machines/issue.js";
import { PULL_REQUEST_PUBLICATION_STATES } from "../state-machines/pull-request-publication.js";
import { PULL_REQUEST_STATES } from "../state-machines/pull-request.js";
import { REVIEW_COMMENT_STATES } from "../state-machines/review-comment.js";
import { REVIEW_STATES } from "../state-machines/review.js";
import { RUN_STATES } from "../state-machines/run.js";
import { STEP_RUN_STATES } from "../state-machines/step-run.js";

const EXTERNAL_ISSUE_SOURCES = ["linear", "github"] as const;
export type IssueSource = "local" | (typeof EXTERNAL_ISSUE_SOURCES)[number];

export const WORKTREE_STATUSES = ["active", "archived", "removed"] as const;
export const worktreeStatusSchema = z.enum(WORKTREE_STATUSES);
export type WorktreeStatus = (typeof WORKTREE_STATUSES)[number];

const issueContractBaseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string().min(1),
  body: z.string().nullable(),
  status: z.enum(ISSUE_STATES),
});

export const issueContractSchema = z.discriminatedUnion("source", [
  issueContractBaseSchema.extend({
    source: z.literal("local"),
    source_external_id: z.null(),
    source_identifier: z.null(),
    source_url: z.null(),
    synced_at: z.null(),
  }),
  issueContractBaseSchema.extend({
    source: z.enum(EXTERNAL_ISSUE_SOURCES),
    source_external_id: z.string().min(1),
    source_identifier: z.string().min(1),
    source_url: z.url().nullable(),
    synced_at: z.iso.datetime(),
  }),
]);
export type IssueContract = z.infer<typeof issueContractSchema>;

const issueSourceContractBaseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source: z.enum(EXTERNAL_ISSUE_SOURCES),
  external_team_id: z.string(),
  external_team_key: z.string(),
  external_team_name: z.string(),
  last_synced_at: z.iso.datetime().nullable(),
});

export const issueSourceContractSchema = z.union([
  issueSourceContractBaseSchema.extend({
    external_project_id: z.literal(""),
    external_project_name: z.literal(""),
  }),
  issueSourceContractBaseSchema.extend({
    external_project_id: z.string().min(1),
    external_project_name: z.string().min(1),
  }),
]);
export type IssueSourceContract = z.infer<typeof issueSourceContractSchema>;

/** One unit of agent work inside a frozen run plan. */
export const runPlanStepSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
  depends_on: z.array(z.string()),
});
export type RunPlanStep = z.infer<typeof runPlanStepSchema>;

/** One executable candidate inside a compete group. Dependencies belong to the group. */
export const runPlanCompetitorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
});
export type RunPlanCompetitor = z.infer<typeof runPlanCompetitorSchema>;

/** One dependency node whose candidates run in isolation until a user selects a winner. */
export const runPlanCompeteGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  depends_on: z.array(z.string()),
  compete: z.array(runPlanCompetitorSchema).min(2),
});
export type RunPlanCompeteGroup = z.infer<typeof runPlanCompeteGroupSchema>;

export const runPlanNodeSchema = z.union([runPlanStepSchema, runPlanCompeteGroupSchema]);
export type RunPlanNode = z.infer<typeof runPlanNodeSchema>;

export function isRunPlanCompeteGroup(node: RunPlanNode): node is RunPlanCompeteGroup {
  return "compete" in node;
}

/** `runs.plan_json` — the plan frozen at launch. There are no workflow revisions. */
export const runPlanSchema = z.object({
  version: z.literal(1),
  steps: z.array(runPlanNodeSchema),
});
export type RunPlan = z.infer<typeof runPlanSchema>;

export const runContractSchema = z.object({
  id: z.string(),
  issue_id: z.string(),
  status: z.enum(RUN_STATES),
  branch: z.string(),
  plan_json: runPlanSchema,
});
export type RunContract = z.infer<typeof runContractSchema>;

export const stepRunContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  /** Zero-based position of this step within the run. */
  idx: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.enum(STEP_RUN_STATES),
  compete_group_id: z.string().nullable(),
  worktree_id: z.string().nullable(),
  branch: z.string().nullable(),
  worktree_status: worktreeStatusSchema.nullable(),
});
export type StepRunContract = z.infer<typeof stepRunContractSchema>;

export const competeGroupContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  idx: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.enum(COMPETE_GROUP_STATES),
  winner_step_run_id: z.string().nullable(),
  base_head_sha: z.string().nullable(),
});
export type CompeteGroupContract = z.infer<typeof competeGroupContractSchema>;

export const agentSessionContractSchema = z.object({
  id: z.string(),
  step_run_id: z.string(),
  agent_id: z.string().nullable(),
  status: z.enum(AGENT_SESSION_STATES),
  /** The runtime provider's own session id; null until the provider assigns one, then reused when resuming the session. */
  provider_session_id: z.string().nullable(),
});
export type AgentSessionContract = z.infer<typeof agentSessionContractSchema>;

export const reviewContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  status: z.enum(REVIEW_STATES),
});
export type ReviewContract = z.infer<typeof reviewContractSchema>;

/** Pin-to-SHA review comment: `(file_path, line, diff_sha)` is immutable, never live-migrated. */
export const reviewCommentContractSchema = z.object({
  id: z.string(),
  review_id: z.string(),
  file_path: z.string(),
  line: z.number().int().nonnegative(),
  diff_sha: z.string(),
  body: z.string(),
  status: z.enum(REVIEW_COMMENT_STATES),
  /** The hunk (or whole file patch) captured at comment time, shown once the anchor goes stale. */
  hunk_snapshot: z.string(),
  fix_requested_at: z.iso.datetime().nullable(),
});
export type ReviewCommentContract = z.infer<typeof reviewCommentContractSchema>;

/** Durable mirror of one run's GitHub pull request and its local publication progress. */
export const pullRequestContractSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    provider: z.literal("github"),
    number: z.number().int().positive().nullable(),
    url: z.url().nullable(),
    status: z.enum(PULL_REQUEST_STATES),
    publication_status: z.enum(PULL_REQUEST_PUBLICATION_STATES),
    title: z.string(),
    body: z.string().nullable(),
    head_ref: z.string().nullable(),
    base_ref: z.string().nullable(),
    published_head_sha: z.string().nullable(),
    published_diff_sha: z.string().nullable(),
    error_code: z.string().nullable(),
    error_message: z.string().nullable(),
    has_unpublished_changes: z.boolean().nullable(),
  })
  .superRefine((pullRequest, context) => {
    if (pullRequest.publication_status !== "created") return;
    const confirmedMetadata = [
      pullRequest.number,
      pullRequest.url,
      pullRequest.head_ref,
      pullRequest.base_ref,
      pullRequest.published_head_sha,
      pullRequest.published_diff_sha,
    ];
    if (confirmedMetadata.some((value) => value === null)) {
      context.addIssue({
        code: "custom",
        message: "Created pull requests require confirmed provider metadata",
      });
    }
  });
export type PullRequestContract = z.infer<typeof pullRequestContractSchema>;

export const projectContractSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  root_path: z.string(),
});
export type ProjectContract = z.infer<typeof projectContractSchema>;

export const repositoryContractSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string().min(1),
  remote_url: z.string().nullable(),
  default_branch: z.string(),
});
export type RepositoryContract = z.infer<typeof repositoryContractSchema>;
