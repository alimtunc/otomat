import { z } from "zod";

import { AGENT_SESSION_STATES } from "../state-machines/agent-session.js";
import { ISSUE_STATES } from "../state-machines/issue.js";
import { PULL_REQUEST_STATES } from "../state-machines/pull-request.js";
import { REVIEW_COMMENT_STATES } from "../state-machines/review-comment.js";
import { REVIEW_STATES } from "../state-machines/review.js";
import { RUN_STATES } from "../state-machines/run.js";
import { STEP_RUN_STATES } from "../state-machines/step-run.js";

/** External systems an issue can be mirrored from. `local` is the default. */
export const ISSUE_SOURCES = ["local", "linear", "github"] as const;
export const issueSourceSchema = z.enum(ISSUE_SOURCES);
export type IssueSource = (typeof ISSUE_SOURCES)[number];

export const issueContractSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string().min(1),
  body: z.string().nullable(),
  status: z.enum(ISSUE_STATES),
  source: issueSourceSchema,
  source_external_id: z.string().nullable(),
  synced_at: z.iso.datetime().nullable(),
});
export type IssueContract = z.infer<typeof issueContractSchema>;

/** One unit of agent work inside a frozen run plan. */
export const runPlanStepSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
  depends_on: z.array(z.string()),
});
export type RunPlanStep = z.infer<typeof runPlanStepSchema>;

/** `runs.plan_json` — the plan frozen at launch. There are no workflow revisions. */
export const runPlanSchema = z.object({
  version: z.literal(1),
  steps: z.array(runPlanStepSchema),
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
});
export type StepRunContract = z.infer<typeof stepRunContractSchema>;

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

/** Local PR record; preparing one is a stub (nothing hits the provider), so `number` and `url` stay null until a real PR exists. */
export const pullRequestContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  provider: z.literal("github"),
  number: z.number().int().positive().nullable(),
  url: z.url().nullable(),
  status: z.enum(PULL_REQUEST_STATES),
  title: z.string(),
  body: z.string().nullable(),
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
