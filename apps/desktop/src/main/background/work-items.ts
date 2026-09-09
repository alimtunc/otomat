import type { ActivityContract, RunState } from "@otomat/domain";

/** Ordered by how much they need the operator, which is the order the menu bar lists them in. */
export const LOCAL_WORK_STATES = ["waiting", "running", "failed"] as const;
export type LocalWorkState = (typeof LOCAL_WORK_STATES)[number];

export interface LocalWorkItem {
  run_id: string;
  project: string;
  issue: string;
  state: LocalWorkState;
  started_at: string | null;
}

/** Runs blocked on an answer only the operator can give; their provider turn dies with the daemon. */
const WAITING_STATES = new Set<RunState>([
  "awaiting_permission",
  "awaiting_human",
  "awaiting_selection",
]);

const rank = (state: LocalWorkState): number => LOCAL_WORK_STATES.indexOf(state);

function workState(activity: ActivityContract): LocalWorkState | null {
  if (activity.kind === "run" && WAITING_STATES.has(activity.status)) return "waiting";
  if (activity.bucket === "running" || activity.bucket === "queued") return "running";
  if (activity.kind !== "run") return null;
  return activity.status === "failed" ? "failed" : null;
}

/** A run and the operations the daemon carries out for it share one `run_id`; that workspace is one item. */
export function localWorkItems(activities: readonly ActivityContract[]): LocalWorkItem[] {
  const items = new Map<string, LocalWorkItem>();
  for (const activity of activities) {
    const state = workState(activity);
    if (state === null) continue;
    const startedAt = activity.kind === "run" ? activity.started_at : null;
    const held = items.get(activity.run_id);
    if (held === undefined) {
      items.set(activity.run_id, {
        run_id: activity.run_id,
        project: activity.project.name,
        issue: activity.issue.identifier ?? activity.issue.title,
        state,
        started_at: startedAt,
      });
      continue;
    }
    if (rank(state) < rank(held.state)) held.state = state;
    held.started_at ??= startedAt;
  }
  return [...items.values()].toSorted((a, b) => rank(a.state) - rank(b.state));
}

/** Work a quit would cut short. A failure loses nothing by quitting. */
export function hasLiveWork(items: readonly LocalWorkItem[]): boolean {
  return items.some((item) => item.state !== "failed");
}
