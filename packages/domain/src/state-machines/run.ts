import { defineMachine } from "./machine.js";

export const RUN_STATES = [
  "queued",
  "preparing",
  "running",
  "awaiting_permission",
  "awaiting_human",
  "awaiting_selection",
  "review_ready",
  "completed",
  "failed",
  "canceled",
] as const;

export type RunState = (typeof RUN_STATES)[number];

/** `failed` and `canceled` are rests, not ends: an explicit resume reopens the run through `preparing`, and only a merged `completed` has no way out. */
export const runMachine = defineMachine<RunState>({
  name: "run",
  initial: "queued",
  transitions: {
    queued: ["preparing", "canceled"],
    preparing: ["running", "failed", "canceled"],
    running: [
      "awaiting_permission",
      "awaiting_human",
      "awaiting_selection",
      "review_ready",
      "failed",
      "canceled",
    ],
    awaiting_permission: ["running", "failed", "canceled"],
    awaiting_human: ["running", "preparing", "failed", "canceled"],
    awaiting_selection: ["running", "failed", "canceled"],
    review_ready: ["completed", "running", "failed", "canceled"],
    completed: [],
    failed: ["preparing"],
    canceled: ["preparing"],
  },
});

/** Run states with no execution left in flight; landing on one stamps `completed_at`. */
export const RUN_SETTLED_STATES = [
  "completed",
  "failed",
  "canceled",
] as const satisfies readonly RunState[];
export type RunSettledState = (typeof RUN_SETTLED_STATES)[number];

const runSettledSet: ReadonlySet<string> = new Set(RUN_SETTLED_STATES);

export function isRunSettled(status: string): status is RunSettledState {
  return runSettledSet.has(status);
}

/** Resting states a user follow-up can resume from: the run awaits an explicit human action, not a process. */
export const RUN_FOLLOW_UP_STATES = [
  "awaiting_human",
  "review_ready",
] as const satisfies readonly RunState[];
export type RunFollowUpState = (typeof RUN_FOLLOW_UP_STATES)[number];

const runFollowUpSet: ReadonlySet<string> = new Set(RUN_FOLLOW_UP_STATES);

export function canFollowUpRun(status: string): status is RunFollowUpState {
  return runFollowUpSet.has(status);
}

/** States an explicit **Resume run** reopens; `completed` is the merged end of the cycle and stays closed. */
export const RUN_RESUMABLE_STATES = [
  "awaiting_human",
  "failed",
  "canceled",
] as const satisfies readonly RunState[];
export type RunResumableState = (typeof RUN_RESUMABLE_STATES)[number];

const runResumableSet: ReadonlySet<string> = new Set(RUN_RESUMABLE_STATES);

export function isRunResumable(status: string): status is RunResumableState {
  return runResumableSet.has(status);
}

/** States with a provider turn genuinely in flight. `awaiting_permission` and `awaiting_selection` are in neither this set nor the resting one: the turn is blocked on an answer. */
export const RUN_WORKING_STATES = [
  "queued",
  "preparing",
  "running",
] as const satisfies readonly RunState[];
export type RunWorkingState = (typeof RUN_WORKING_STATES)[number];

const runWorkingSet: ReadonlySet<string> = new Set(RUN_WORKING_STATES);

export function isRunWorking(status: string): status is RunWorkingState {
  return runWorkingSet.has(status);
}

/** A provider turn is live, or blocked mid-turn on a permission answer; either way the run still occupies its worktree. */
export function isRunBusy(status: string): boolean {
  return isRunWorking(status) || status === "awaiting_permission";
}
