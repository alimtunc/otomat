/**
 * Type-only entrypoint for `@otomat/domain`, served at the `./types` subpath. It
 * re-exports the entity, state, event-envelope, and diff types via `export type`,
 * so importing here erases at build time and pulls in no runtime code — not zod,
 * not the state-machine singletons. Prefer it when a module needs only types;
 * import the root `@otomat/domain` when it needs the schemas or machines at
 * runtime. This is a curated subset: the HTTP contracts (`contracts/api`) are
 * not re-exported here.
 *
 * @packageDocumentation
 */
export type { IssueState } from "./state-machines/issue.js";
export type { RunState, RunTerminalState } from "./state-machines/run.js";
export type { StepRunState } from "./state-machines/step-run.js";
export type { AgentSessionState } from "./state-machines/agent-session.js";
export type { ReviewState } from "./state-machines/review.js";
export type { ReviewCommentState } from "./state-machines/review-comment.js";
export type { PullRequestState } from "./state-machines/pull-request.js";
export type { PullRequestPublicationState } from "./state-machines/pull-request-publication.js";

export type { EventType, EventSource, EventEnvelope } from "./events/envelope.js";

export type {
  IssueSource,
  IssueContract,
  ProjectContract,
  RepositoryContract,
  RunContract,
  RunPlan,
  RunPlanStep,
  StepRunContract,
  AgentSessionContract,
  ReviewContract,
  ReviewCommentContract,
  PullRequestContract,
} from "./contracts/entities.js";

export type {
  ChangeStatus,
  DiffFileContract,
  RunDiffContract,
  RunDiffResponse,
} from "./contracts/diff.js";
