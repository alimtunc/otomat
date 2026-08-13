import type {
  AgentSessionState,
  ChangeStatus,
  CompeteGroupState,
  IssueState,
  PullRequestState,
  ReviewCommentPublicationState,
  ReviewCommentState,
  ReviewState,
  RunContributionState,
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
  Loader,
  MessageCircleQuestion,
  MessageSquare,
  Pause,
  Send,
  ShieldQuestion,
  Square,
  TriangleAlert,
} from "lucide-react";

import type { KindStatusMap, StatusKind, StatusMap } from "./types";

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
  awaiting_selection: { tone: "warning", icon: GitCompare, label: "Awaiting winner" },
  review_ready: { tone: "review", icon: GitCompare, label: "Review ready" },
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Failed" },
  canceled: { tone: "neutral", icon: Ban, label: "Canceled" },
};

const RUN_CONTRIBUTION_STATUS: StatusMap<RunContributionState> = {
  queued: { tone: "neutral", icon: Clock, label: "Queued" },
  delivered: { tone: "iris", icon: Send, label: "Delivered" },
  acknowledged: { tone: "success", icon: CheckCircle2, label: "Acknowledged" },
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

const COMPETE_STATUS: StatusMap<CompeteGroupState> = {
  queued: { tone: "neutral", icon: Clock, label: "Queued" },
  running: { tone: "iris", icon: Loader, label: "Competing", live: true },
  awaiting_human: { tone: "warning", icon: Hand, label: "Awaiting human" },
  awaiting_selection: { tone: "warning", icon: GitCompare, label: "Choose winner" },
  promoting: { tone: "iris", icon: GitMerge, label: "Promoting", live: true },
  selected: { tone: "success", icon: CheckCircle2, label: "Winner selected" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Failed" },
  canceled: { tone: "neutral", icon: Ban, label: "Canceled" },
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

const REVIEW_COMMENT_PUBLICATION_STATUS: StatusMap<ReviewCommentPublicationState> = {
  local: { tone: "neutral", icon: MessageSquare, label: "Local" },
  pending: { tone: "iris", icon: Send, label: "Publishing", live: true },
  published: { tone: "success", icon: GitPullRequest, label: "Published" },
  failed: { tone: "danger", icon: TriangleAlert, label: "Publish failed" },
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

export const STATUS_REGISTRY: { [K in StatusKind]: StatusMap<KindStatusMap[K]> } = {
  issue: ISSUE_STATUS,
  run: RUN_STATUS,
  runContribution: RUN_CONTRIBUTION_STATUS,
  step: STEP_STATUS,
  session: SESSION_STATUS,
  compete: COMPETE_STATUS,
  review: REVIEW_STATUS,
  reviewComment: REVIEW_COMMENT_STATUS,
  reviewCommentPublication: REVIEW_COMMENT_PUBLICATION_STATUS,
  pr: PR_STATUS,
  diffFile: DIFF_FILE_STATUS,
};
