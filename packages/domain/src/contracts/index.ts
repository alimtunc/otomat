/**
 * Zod contracts shared by daemon and client: HTTP request/response shapes
 * (`api`), the canonical run diff with its pin-to-SHA anchors (`diff`), and the
 * persisted entity mirrors (`entities`). Parsing a payload through these schemas
 * is what guarantees both sides agree on wire shape and invariants.
 *
 * @packageDocumentation
 */
export * from "./api.js";
export * from "./diff.js";
export {
  agentSessionContractSchema,
  competeGroupContractSchema,
  issueContractSchema,
  issueSourceContractSchema,
  isRunPlanCompeteGroup,
  projectContractSchema,
  pullRequestContractSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runPlanSchema,
  runPlanCompeteGroupSchema,
  runPlanCompetitorSchema,
  runPlanNodeSchema,
  runPlanStepSchema,
  stepRunContractSchema,
  WORKTREE_STATUSES,
  worktreeStatusSchema,
  type AgentSessionContract,
  type CompeteGroupContract,
  type IssueContract,
  type IssueSource,
  type IssueSourceContract,
  type ProjectContract,
  type PullRequestContract,
  type RepositoryContract,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunPlan,
  type RunPlanCompeteGroup,
  type RunPlanCompetitor,
  type RunPlanNode,
  type RunPlanStep,
  type StepRunContract,
  type WorktreeStatus,
} from "./entities.js";
