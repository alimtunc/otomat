import type {
  AgentSessionState,
  EventSource,
  EventType,
  IssueSource,
  IssueState,
  PullRequestState,
  ReviewState,
  RunState,
  StepRunState,
} from "@otomat/domain/types";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleDotDashed,
  CircleSlash,
  Clock,
  FileDiff,
  Flag,
  GitCommitHorizontal,
  GitCompare,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Hand,
  type LucideIcon,
  Loader,
  MessageCircleQuestion,
  MessageSquare,
  Pause,
  Play,
  ShieldQuestion,
  Square,
  Terminal,
  TriangleAlert,
} from "lucide-react";

export type StatusTone =
  | "neutral"
  | "iris"
  | "success"
  | "warning"
  | "danger"
  | "review"
  | "stale"
  | "ghost";

export type StatusKind = "issue" | "run" | "step" | "session" | "review" | "pr";

// icon (LucideIcon) is the web binding layer; kept in ui on purpose, not in @otomat/domain.
export interface StatusDescriptor {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
  live?: boolean;
}

type StatusMap<K extends string> = Record<K, StatusDescriptor>;

const ISSUE_STATUS: StatusMap<IssueState> = {
  backlog: { tone: "neutral", icon: Circle, label: "Backlog" },
  ready: { tone: "iris", icon: CircleDot, label: "Ready" },
  running: { tone: "iris", icon: Loader, label: "Running", live: true },
  reviewing: { tone: "review", icon: MessageSquare, label: "Reviewing" },
  pr_open: { tone: "success", icon: GitPullRequest, label: "PR open" },
  blocked: { tone: "warning", icon: CircleSlash, label: "Blocked" },
  done: { tone: "success", icon: CheckCircle2, label: "Done" },
  canceled: { tone: "neutral", icon: Ban, label: "Canceled" },
};

const RUN_STATUS: StatusMap<RunState> = {
  queued: { tone: "neutral", icon: Clock, label: "Queued" },
  preparing: { tone: "iris", icon: Loader, label: "Preparing" },
  running: { tone: "iris", icon: Loader, label: "Running", live: true },
  awaiting_permission: { tone: "warning", icon: ShieldQuestion, label: "Awaiting permission" },
  awaiting_human: { tone: "warning", icon: Hand, label: "Awaiting human" },
  review_ready: { tone: "review", icon: GitCompare, label: "Review ready" },
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Failed" },
  canceled: { tone: "neutral", icon: Ban, label: "Canceled" },
};

const STEP_STATUS: StatusMap<StepRunState> = {
  queued: { tone: "neutral", icon: Clock, label: "Queued" },
  starting: { tone: "iris", icon: Loader, label: "Starting" },
  running: { tone: "iris", icon: Loader, label: "Running", live: true },
  awaiting_permission: { tone: "warning", icon: ShieldQuestion, label: "Awaiting permission" },
  awaiting_human: { tone: "warning", icon: Hand, label: "Awaiting human" },
  succeeded: { tone: "success", icon: CheckCircle2, label: "Succeeded" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Failed" },
  canceled: { tone: "neutral", icon: Ban, label: "Canceled" },
  stale: { tone: "stale", icon: AlertTriangle, label: "Stale" },
};

const SESSION_STATUS: StatusMap<AgentSessionState> = {
  created: { tone: "neutral", icon: CircleDotDashed, label: "Created" },
  active: { tone: "success", icon: Activity, label: "Active", live: true },
  idle: { tone: "neutral", icon: Pause, label: "Idle" },
  awaiting_input: { tone: "warning", icon: MessageCircleQuestion, label: "Awaiting input" },
  terminated: { tone: "neutral", icon: Square, label: "Terminated" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Failed" },
};

const REVIEW_STATUS: StatusMap<ReviewState> = {
  open: { tone: "iris", icon: CircleDot, label: "Open" },
  in_review: { tone: "iris", icon: MessageSquare, label: "In review" },
  changes_requested: { tone: "warning", icon: CircleSlash, label: "Changes requested" },
  resolved: { tone: "success", icon: CheckCircle2, label: "Resolved" },
};

const PR_STATUS: StatusMap<PullRequestState> = {
  draft: { tone: "neutral", icon: GitPullRequestDraft, label: "Draft" },
  open: { tone: "success", icon: GitPullRequest, label: "Open" },
  merged: { tone: "review", icon: GitMerge, label: "Merged" },
  closed: { tone: "danger", icon: GitPullRequestClosed, label: "Closed" },
};

interface KindStatusMap {
  issue: IssueState;
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
  review: ReviewState;
  pr: PullRequestState;
}

const STATUS_REGISTRY: { [K in StatusKind]: StatusMap<KindStatusMap[K]> } = {
  issue: ISSUE_STATUS,
  run: RUN_STATUS,
  step: STEP_STATUS,
  session: SESSION_STATUS,
  review: REVIEW_STATUS,
  pr: PR_STATUS,
};

export function resolveStatus<K extends StatusKind>(
  kind: K,
  status: KindStatusMap[K],
): StatusDescriptor {
  return STATUS_REGISTRY[kind][status];
}

export const TONE_COLOR: Record<StatusTone, string> = {
  neutral: "var(--text-tertiary)",
  iris: "var(--iris-text)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  review: "var(--review)",
  stale: "var(--stale)",
  ghost: "var(--text-tertiary)",
};

export const TONE_BG: Partial<Record<StatusTone, string>> = {
  warning: "var(--warning-bg)",
  danger: "var(--danger-bg)",
};

export const HEALTH_COLOR: Record<"healthy" | "degraded" | "unknown", string> = {
  healthy: "var(--success)",
  degraded: "var(--warning)",
  unknown: "var(--neutral)",
};

export const TONE_CHIP_CLASS: Record<StatusTone, string> = {
  neutral: "",
  iris: "chip--iris",
  success: "chip--success",
  warning: "chip--warning",
  danger: "chip--danger",
  review: "chip--review",
  stale: "chip--stale",
  ghost: "chip--ghost",
};

export const PROVENANCE_VAR: Record<EventSource, string> = {
  otomat: "var(--prov-otomat)",
  claude: "var(--prov-claude)",
  codex: "var(--prov-codex)",
  git: "var(--prov-git)",
  github: "var(--prov-github)",
  linear: "var(--prov-linear)",
  system: "var(--prov-system)",
};

export const PROVENANCE_LABEL: Record<EventSource, string> = {
  otomat: "Otomat",
  claude: "Claude",
  codex: "Codex",
  git: "Git",
  github: "GitHub",
  linear: "Linear",
  system: "System",
};

export const SOURCE_BADGE: Record<IssueSource, { var: string; label: string; tone: StatusTone }> = {
  local: { var: "var(--prov-otomat)", label: "Local", tone: "neutral" },
  linear: { var: "var(--prov-linear)", label: "Linear", tone: "review" },
  github: { var: "var(--prov-github)", label: "GitHub", tone: "neutral" },
};

export interface EventGlyphDescriptor {
  icon: LucideIcon;
  tone: StatusTone;
}

export const EVENT_GLYPH: Record<EventType, EventGlyphDescriptor> = {
  "run.lifecycle": { icon: Flag, tone: "neutral" },
  "step.lifecycle": { icon: GitCommitHorizontal, tone: "neutral" },
  "session.lifecycle": { icon: Play, tone: "neutral" },
  "runtime.log": { icon: Terminal, tone: "neutral" },
  "runtime.tool_call": { icon: Terminal, tone: "iris" },
  "runtime.permission_request": { icon: ShieldQuestion, tone: "warning" },
  "runtime.permission_response": { icon: ShieldQuestion, tone: "neutral" },
  "runtime.usage": { icon: Activity, tone: "neutral" },
  "runtime.provider_session": { icon: CircleDotDashed, tone: "neutral" },
  "git.diff_updated": { icon: FileDiff, tone: "stale" },
  "review.comment_created": { icon: MessageSquare, tone: "review" },
  "review.comment_resolved": { icon: CheckCircle2, tone: "success" },
  "pr.created": { icon: GitPullRequest, tone: "success" },
  "pr.updated": { icon: GitPullRequest, tone: "neutral" },
  "system.reconciled": { icon: AlertTriangle, tone: "stale" },
};
