import type {
  AgentSessionState,
  ChangeStatus,
  CompeteGroupState,
  IssueBoardColumn,
  OperationState,
  PullRequestState,
  ReviewCommentPublicationState,
  ReviewCommentState,
  ReviewState,
  RunContributionState,
  RunState,
  StepRunState,
} from "@otomat/domain/types";
import type { LucideIcon } from "lucide-react";

import type { StatusTone } from "../tone";

export type StatusKind =
  | "issue"
  | "run"
  | "runContribution"
  | "step"
  | "session"
  | "compete"
  | "operation"
  | "review"
  | "reviewComment"
  | "reviewCommentPublication"
  | "pr"
  | "diffFile";

export interface StatusDescriptor {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
  /** True for in-progress states that should render a live/animated indicator. */
  live?: boolean;
}

export type StatusMap<K extends string> = Record<K, StatusDescriptor>;

export interface KindStatusMap {
  /** An issue's source status, plus the local `failed` execution the board shows as its own column. */
  issue: IssueBoardColumn;
  run: RunState;
  runContribution: RunContributionState;
  step: StepRunState;
  session: AgentSessionState;
  compete: CompeteGroupState;
  /** A daemon-owned background operation, whatever kind of work it runs. */
  operation: OperationState;
  review: ReviewState;
  reviewComment: ReviewCommentState;
  reviewCommentPublication: ReviewCommentPublicationState;
  pr: PullRequestState;
  diffFile: ChangeStatus;
}
