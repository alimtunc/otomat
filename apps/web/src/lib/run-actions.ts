import { isRunTerminal, type RunState } from "@otomat/domain";

// Mirrors the daemon's abort guard, minus review_ready: its completed marker is honored, so abort would be a silent no-op.
export function canAbortRun(status: RunState): boolean {
  return !isRunTerminal(status) && status !== "review_ready";
}

export function canResumeRun(status: RunState): boolean {
  return status === "awaiting_human";
}
