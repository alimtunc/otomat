import type {
  AgentSessionState,
  ChangeStatus,
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
  FileMinus,
  FilePen,
  FilePlus,
  FileSymlink,
  FileType,
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
  ShieldQuestion,
  Square,
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

const REVIEW_COMMENT_STATUS: StatusMap<ReviewCommentState> = {
  open: { tone: "review", icon: MessageSquare, label: "Open" },
  addressed: { tone: "success", icon: CheckCircle2, label: "Addressed" },
  outdated: { tone: "stale", icon: AlertTriangle, label: "Outdated" },
};

const PR_STATUS: StatusMap<PullRequestState> = {
  draft: { tone: "neutral", icon: GitPullRequestDraft, label: "Draft" },
  open: { tone: "success", icon: GitPullRequest, label: "Open" },
  merged: { tone: "review", icon: GitMerge, label: "Merged" },
  closed: { tone: "danger", icon: GitPullRequestClosed, label: "Closed" },
};

const DIFF_FILE_STATUS: StatusMap<ChangeStatus> = {
  added: { tone: "success", icon: FilePlus, label: "Added" },
  modified: { tone: "review", icon: FilePen, label: "Modified" },
  deleted: { tone: "danger", icon: FileMinus, label: "Deleted" },
  renamed: { tone: "iris", icon: FileSymlink, label: "Renamed" },
  copied: { tone: "iris", icon: Copy, label: "Copied" },
  type_changed: { tone: "neutral", icon: FileType, label: "Type changed" },
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

export interface ToneFacets {
  text: string;
  textOnSubtle: string;
  subtleBg: string;
  solid: string;
  cssVar: string;
  subtleBgVar?: string;
}

export const TONE_FACETS: Record<StatusTone, ToneFacets> = {
  neutral: {
    text: "text-text-tertiary",
    textOnSubtle: "text-text-secondary",
    subtleBg: "bg-neutral-bg",
    solid: "bg-neutral",
    cssVar: "var(--neutral)",
  },
  iris: {
    text: "text-iris-text",
    textOnSubtle: "text-iris-text",
    subtleBg: "bg-iris-bg",
    solid: "bg-iris",
    cssVar: "var(--iris-solid)",
  },
  success: {
    text: "text-success",
    textOnSubtle: "text-success",
    subtleBg: "bg-success-bg",
    solid: "bg-success",
    cssVar: "var(--success)",
  },
  warning: {
    text: "text-warning",
    textOnSubtle: "text-warning",
    subtleBg: "bg-warning-bg",
    solid: "bg-warning",
    cssVar: "var(--warning)",
    subtleBgVar: "var(--warning-bg)",
  },
  danger: {
    text: "text-danger",
    textOnSubtle: "text-danger",
    subtleBg: "bg-danger-bg",
    solid: "bg-danger",
    cssVar: "var(--danger)",
    subtleBgVar: "var(--danger-bg)",
  },
  review: {
    text: "text-review",
    textOnSubtle: "text-review",
    subtleBg: "bg-review-bg",
    solid: "bg-review",
    cssVar: "var(--review)",
  },
  stale: {
    text: "text-stale",
    textOnSubtle: "text-stale",
    subtleBg: "bg-stale-bg",
    solid: "bg-stale",
    cssVar: "var(--stale)",
  },
  ghost: {
    text: "text-text-tertiary",
    textOnSubtle: "text-text-secondary",
    subtleBg: "bg-transparent border-border",
    solid: "bg-text-tertiary",
    cssVar: "var(--text-tertiary)",
  },
};

const TONE_ENTRIES = Object.entries(TONE_FACETS) as [StatusTone, ToneFacets][];

export function toneClassMap(pick: (facets: ToneFacets) => string): Record<StatusTone, string> {
  return Object.fromEntries(TONE_ENTRIES.map(([tone, facets]) => [tone, pick(facets)])) as Record<
    StatusTone,
    string
  >;
}

export const TONE_TEXT: Record<StatusTone, string> = toneClassMap((facets) => facets.text);

export const TONE_BG: Partial<Record<StatusTone, string>> = Object.fromEntries(
  TONE_ENTRIES.flatMap(([tone, facets]) =>
    facets.subtleBgVar ? [[tone, facets.subtleBgVar]] : [],
  ),
);
