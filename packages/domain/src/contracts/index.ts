/**
 * Zod contracts shared by daemon and client: HTTP request/response shapes
 * (`api`), the canonical run diff with its pin-to-SHA anchors (`diff`), the
 * persisted entity mirrors (`entities`), the local data-safety error taxonomy
 * and managed-artifact grammar (`data-safety`), the incident report shared by
 * renderer, daemon and shell (`diagnostics`), and the Electron shell's
 * renderer bridge surface (`desktop`). Parsing a payload through the zod
 * schemas is what
 * guarantees both sides agree on wire shape and invariants.
 *
 * @packageDocumentation
 */
export * from "./api.js";
export * from "./data-safety.js";
export * from "./desktop.js";
export * from "./diagnostics.js";
export * from "./diff.js";
export * from "./execution-host.js";
export {
  agentProfileContractSchema,
  agentSessionContractSchema,
  competeGroupContractSchema,
  CLOSED_ISSUE_WORKSPACE,
  ISSUE_EXECUTION_STATES,
  issueContractSchema,
  issueExecutionSchema,
  issueSourceContractSchema,
  issueWorkspaceSchema,
  isRunPlanCompeteGroup,
  projectContractSchema,
  pullRequestContractSchema,
  repositoryContractSchema,
  resolvedAgentConfigSchema,
  resolvedSkillSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  runContributionContractSchema,
  runPlanSchema,
  runPlanCompeteGroupSchema,
  runPlanCompetitorSchema,
  runPlanNodeSchema,
  runPlanStepSchema,
  skillContractSchema,
  skillInvalidReasonSchema,
  skillSourceSchema,
  skillStatusSchema,
  SKILL_INVALID_REASONS,
  SKILL_SOURCES,
  SKILL_STATUSES,
  sourceLabelSchema,
  stepRunContractSchema,
  WORKTREE_STATUSES,
  worktreeStatusSchema,
  type AgentProfileContract,
  type AgentSessionContract,
  type CompeteGroupContract,
  type ExternalIssueSource,
  type IssueContract,
  type IssueExecution,
  type IssueExecutionState,
  type IssueSource,
  type IssueSourceContract,
  type IssueWorkspace,
  type ProjectContract,
  type PullRequestContract,
  type RepositoryContract,
  type ResolvedAgentConfig,
  type ResolvedSkill,
  type ReviewCommentContract,
  type ReviewContract,
  type RunContract,
  type RunContributionContract,
  type RunPlan,
  type RunPlanCompeteGroup,
  type RunPlanCompetitor,
  type RunPlanNode,
  type RunPlanStep,
  type SkillContract,
  type SkillInvalidReason,
  type SkillSource,
  type SkillStatus,
  type SourceLabel,
  type StepRunContract,
  type WorktreeStatus,
} from "./entities/index.js";
