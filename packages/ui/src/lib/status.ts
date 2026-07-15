import type {
  AgentSessionState,
  ChangeStatus,
  EventSource,
  EventType,
  IssueSource,
  IssueState,
  PullRequestState,
  ReviewCommentState,
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
  Copy,
  FileDiff,
  FileMinus,
  FilePen,
  FilePlus,
  FileSymlink,
  FileType,
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

export type StatusKind =
  | "issue"
  | "run"
  | "step"
  | "session"
  | "review"
  | "reviewComment"
  | "pr"
  | "diffFile";

// icon (LucideIcon) is the web binding layer; kept in ui on purpose, not in @otomat/domain.
export interface StatusDescriptor {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
  /** True for in-progress states that should render a live/animated indicator. */
  live?: boolean;
}

type StatusMap<K extends string> = Record<K, StatusDescriptor>;

const ISSUE_STATUS: StatusMap<IssueState> = {
  backlog: { tone: "neutral", icon: Circle, label: "backlog" },
  ready: { tone: "iris", icon: CircleDot, label: "ready" },
  running: { tone: "iris", icon: Loader, label: "running", live: true },
  reviewing: { tone: "review", icon: MessageSquare, label: "reviewing" },
  pr_open: { tone: "success", icon: GitPullRequest, label: "PR open" },
  blocked: { tone: "warning", icon: CircleSlash, label: "blocked" },
  done: { tone: "success", icon: CheckCircle2, label: "done" },
  canceled: { tone: "neutral", icon: Ban, label: "canceled" },
};

const RUN_STATUS: StatusMap<RunState> = {
  queued: { tone: "neutral", icon: Clock, label: "queued" },
  preparing: { tone: "iris", icon: Loader, label: "preparing" },
  running: { tone: "iris", icon: Loader, label: "running", live: true },
  awaiting_permission: { tone: "warning", icon: ShieldQuestion, label: "awaiting permission" },
  awaiting_human: { tone: "warning", icon: Hand, label: "awaiting human" },
  review_ready: { tone: "review", icon: GitCompare, label: "review ready" },
  completed: { tone: "success", icon: CheckCircle2, label: "completed" },
  failed: { tone: "danger", icon: TriangleAlert, label: "failed" },
  canceled: { tone: "neutral", icon: Ban, label: "canceled" },
};

const STEP_STATUS: StatusMap<StepRunState> = {
  queued: { tone: "neutral", icon: Clock, label: "queued" },
  starting: { tone: "iris", icon: Loader, label: "starting" },
  running: { tone: "iris", icon: Loader, label: "running", live: true },
  awaiting_permission: { tone: "warning", icon: ShieldQuestion, label: "awaiting permission" },
  awaiting_human: { tone: "warning", icon: Hand, label: "awaiting human" },
  succeeded: { tone: "success", icon: CheckCircle2, label: "succeeded" },
  failed: { tone: "danger", icon: TriangleAlert, label: "failed" },
  canceled: { tone: "neutral", icon: Ban, label: "canceled" },
  stale: { tone: "stale", icon: AlertTriangle, label: "stale" },
};

const SESSION_STATUS: StatusMap<AgentSessionState> = {
  created: { tone: "neutral", icon: CircleDotDashed, label: "created" },
  active: { tone: "success", icon: Activity, label: "active", live: true },
  idle: { tone: "neutral", icon: Pause, label: "idle" },
  awaiting_input: { tone: "warning", icon: MessageCircleQuestion, label: "awaiting input" },
  terminated: { tone: "neutral", icon: Square, label: "terminated" },
  failed: { tone: "danger", icon: TriangleAlert, label: "failed" },
};

const REVIEW_STATUS: StatusMap<ReviewState> = {
  open: { tone: "iris", icon: CircleDot, label: "open" },
  in_review: { tone: "iris", icon: MessageSquare, label: "in review" },
  changes_requested: { tone: "warning", icon: CircleSlash, label: "changes requested" },
  resolved: { tone: "success", icon: CheckCircle2, label: "resolved" },
};

const REVIEW_COMMENT_STATUS: StatusMap<ReviewCommentState> = {
  open: { tone: "review", icon: MessageSquare, label: "open" },
  addressed: { tone: "success", icon: CheckCircle2, label: "addressed" },
  outdated: { tone: "stale", icon: AlertTriangle, label: "outdated" },
};

const PR_STATUS: StatusMap<PullRequestState> = {
  draft: { tone: "neutral", icon: GitPullRequestDraft, label: "draft" },
  open: { tone: "success", icon: GitPullRequest, label: "open" },
  merged: { tone: "review", icon: GitMerge, label: "merged" },
  closed: { tone: "danger", icon: GitPullRequestClosed, label: "closed" },
};

const DIFF_FILE_STATUS: StatusMap<ChangeStatus> = {
  added: { tone: "success", icon: FilePlus, label: "added" },
  modified: { tone: "review", icon: FilePen, label: "modified" },
  deleted: { tone: "danger", icon: FileMinus, label: "deleted" },
  renamed: { tone: "iris", icon: FileSymlink, label: "renamed" },
  copied: { tone: "iris", icon: Copy, label: "copied" },
  type_changed: { tone: "neutral", icon: FileType, label: "type changed" },
};

export interface KindStatusMap {
  issue: IssueState;
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
  review: ReviewState;
  reviewComment: ReviewCommentState;
  pr: PullRequestState;
  diffFile: ChangeStatus;
}

const STATUS_REGISTRY: { [K in StatusKind]: StatusMap<KindStatusMap[K]> } = {
  issue: ISSUE_STATUS,
  run: RUN_STATUS,
  step: STEP_STATUS,
  session: SESSION_STATUS,
  review: REVIEW_STATUS,
  reviewComment: REVIEW_COMMENT_STATUS,
  pr: PR_STATUS,
  diffFile: DIFF_FILE_STATUS,
};

/** Resolves the visual descriptor (tone, icon, label) for a domain status; total over every state of each `StatusKind`. */
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
  "runtime.message": { icon: MessageSquare, tone: "neutral" },
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
