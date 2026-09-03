import type { ActivityContract, RunState } from "@otomat/domain";

export interface LocalWorkSummary {
  active: number;
  waiting: number;
  failed: number;
}

/** Runs blocked on an answer only the operator can give; their provider turn dies with the daemon. */
const WAITING_STATES = new Set<RunState>([
  "awaiting_permission",
  "awaiting_human",
  "awaiting_selection",
]);

/** A run and the operations the daemon carries out for it share one `run_id`; that workspace counts once. */
export function summarizeLocalWork(activities: readonly ActivityContract[]): LocalWorkSummary {
  const active = new Set<string>();
  let waiting = 0;
  let failed = 0;
  for (const activity of activities) {
    if (activity.bucket === "running" || activity.bucket === "queued") {
      active.add(activity.run_id);
      continue;
    }
    if (activity.kind !== "run") continue;
    if (WAITING_STATES.has(activity.status)) waiting += 1;
    else if (activity.status === "failed") failed += 1;
  }
  return { active: active.size, waiting, failed };
}

/** Work a quit would cut short. A failure and a finished review lose nothing by quitting. */
export function hasLiveWork(summary: LocalWorkSummary): boolean {
  return summary.active + summary.waiting > 0;
}
