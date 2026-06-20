import type {
  AgentSessionState,
  IssueState,
  PullRequestState,
  ReviewState,
  RunState,
  StepRunState,
} from "@otomat/domain/types";

import { resolveStatus, type StatusKind } from "../lib/status";
import { cn } from "../lib/utils";
import { Chip, type ChipSize } from "./chip";

interface KindStatusMap {
  issue: IssueState;
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
  review: ReviewState;
  pr: PullRequestState;
}

export interface StatusChipProps<K extends StatusKind = StatusKind> {
  kind: K;
  status: KindStatusMap[K];
  size?: ChipSize;
  showLabel?: boolean;
  className?: string;
}

export function StatusChip<K extends StatusKind>({
  kind,
  status,
  size = "sm",
  showLabel = true,
  className,
}: StatusChipProps<K>) {
  const { tone, icon: Icon, label, live } = resolveStatus(kind, status);

  return (
    <Chip
      tone={tone}
      size={size}
      className={cn(!showLabel && "px-1.25", className)}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
    >
      <Icon aria-hidden className={cn(live && "animate-spin motion-reduce:animate-none")} />
      {showLabel ? <span>{label}</span> : null}
    </Chip>
  );
}

export interface PresetStatusChipProps<S> {
  status: S;
  size?: ChipSize;
  showLabel?: boolean;
  className?: string;
}

export function IssueStatusChip(props: PresetStatusChipProps<IssueState>) {
  return <StatusChip kind="issue" {...props} />;
}

export function RunStatusChip(props: PresetStatusChipProps<RunState>) {
  return <StatusChip kind="run" {...props} />;
}

export function StepStatusChip(props: PresetStatusChipProps<StepRunState>) {
  return <StatusChip kind="step" {...props} />;
}

export function SessionStatusChip(props: PresetStatusChipProps<AgentSessionState>) {
  return <StatusChip kind="session" {...props} />;
}

export function ReviewStatusChip(props: PresetStatusChipProps<ReviewState>) {
  return <StatusChip kind="review" {...props} />;
}

export function PRStatusBadge(props: PresetStatusChipProps<PullRequestState>) {
  return <StatusChip kind="pr" {...props} />;
}
