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
export * from "./commit-subject.js";
export * from "./data-safety.js";
export * from "./desktop.js";
export * from "./diagnostics.js";
export * from "./diff.js";
export * from "./execution-host.js";
export * from "./run-plan.js";
export {
  agentProfileContractSchema,
  agentSessionContractSchema,
  competeGroupContractSchema,
  CLOSED_ISSUE_WORKSPACE,
  ISSUE_BOARD_COLUMNS,
  issueContractSchema,
  issueExecutionSchema,
  issueSourceContractSchema,
  issueWorkspaceSchema,
  isReviewCommentDestination,
  projectContractSchema,
  PULL_REQUEST_PUBLICATION_MODES,
  pullRequestContractSchema,
  pullRequestGeneratorAuditSchema,
  repositoryContractSchema,
  resolvedAgentConfigSchema,
  resolvedSkillSchema,
  REVIEW_COMMENT_DESTINATIONS,
  reviewCommentContractSchema,
  reviewCommentDestinationSchema,
  reviewContractSchema,
  runContractSchema,
  runContributionContractSchema,
  skillContractSchema,
  skillInvalidReasonSchema,
  skillSourceSchema,
  skillStatusSchema,
  sourceLabelSchema,
  stepRunContractSchema,
  worktreeStatusSchema,
  type AgentProfileContract,
  type AgentSessionContract,
  type CompeteGroupContract,
  type ExternalIssueSource,
  type IssueBoardColumn,
  type IssueContract,
  type IssueExecution,
  type IssueExecutionFailure,
  type IssueExecutionFailureReason,
  type IssueExecutionState,
  type IssueSource,
  type IssueSourceContract,
  type IssueWorkspace,
  type ProjectContract,
  type PullRequestContract,
  type PullRequestGeneratorAudit,
  type PullRequestPublicationMode,
  type RepositoryContract,
  type ResolvedAgentConfig,
  type ResolvedSkill,
  type ReviewCommentContract,
  type ReviewCommentDestination,
  type ReviewContract,
  type RunContract,
  type RunContributionContract,
  type SkillContract,
  type SkillInvalidReason,
  type SkillSource,
  type SkillStatus,
  type SourceLabel,
  type StepRunContract,
  type WorktreeStatus,
} from "./entities/index.js";
