import { isRunSettled, type RunState } from "@otomat/domain";

/** Cancel stops a turn or a queue; a run already resting at review has nothing to stop. */
export function canAbortRun(status: RunState): boolean {
  return !isRunSettled(status) && status !== "review_ready";
}
