import { isRunTerminal, type RunState } from "@otomat/domain";

export function canAbortRun(status: RunState): boolean {
  return !isRunTerminal(status) && status !== "review_ready";
}

export function canResumeRun(status: RunState): boolean {
  return status === "awaiting_human";
}
