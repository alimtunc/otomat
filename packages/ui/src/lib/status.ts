import type {
  AgentSessionState,
  ChangeStatus,
  CompeteGroupState,
  IssueState,
  PullRequestState,
  ReviewCommentState,
  ReviewState,
  RunContributionState,
  RunState,
  StepRunState,
} from "@otomat/domain/types";
import type { LucideIcon } from "lucide-react";

import { STATUS_REGISTRY } from "./status-registry";
import type { StatusTone } from "./tone";

export type StatusKind =
  | "issue"
  | "run"
  | "runContribution"
  | "step"
  | "session"
  | "compete"
  | "review"
  | "reviewComment"
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
  issue: IssueState;
  run: RunState;
  runContribution: RunContributionState;
  step: StepRunState;
  session: AgentSessionState;
  compete: CompeteGroupState;
  review: ReviewState;
  reviewComment: ReviewCommentState;
  pr: PullRequestState;
  diffFile: ChangeStatus;
}

/** Resolves the visual descriptor (tone, icon, label) for a domain status; total over every state of each `StatusKind`. */
export function resolveStatus<K extends StatusKind>(
  kind: K,
  status: KindStatusMap[K],
): StatusDescriptor {
  return STATUS_REGISTRY[kind][status];
}
