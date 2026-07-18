import { defineMachine } from "./machine.js";

export const RUN_STATES = [
  "queued",
  "preparing",
  "running",
  "awaiting_permission",
  "awaiting_human",
  "review_ready",
  "completed",
  "failed",
  "canceled",
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const runMachine = defineMachine<RunState>({
  name: "run",
  initial: "queued",
  transitions: {
    queued: ["preparing", "canceled"],
    preparing: ["running", "failed", "canceled"],
    running: ["awaiting_permission", "awaiting_human", "review_ready", "failed", "canceled"],
    awaiting_permission: ["running", "failed", "canceled"],
    awaiting_human: ["running", "failed", "canceled"],
    review_ready: ["completed", "running", "failed", "canceled"],
    completed: [],
    failed: [],
    canceled: [],
  },
});

/** Terminal run states (no outgoing edges); guarded against drift in transitions.test.ts. */
export const RUN_TERMINAL_STATES = [
  "completed",
  "failed",
  "canceled",
] as const satisfies readonly RunState[];
export type RunTerminalState = (typeof RUN_TERMINAL_STATES)[number];

const runTerminalSet: ReadonlySet<string> = new Set(RUN_TERMINAL_STATES);

export function isRunTerminal(status: string): status is RunTerminalState {
  return runTerminalSet.has(status);
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
