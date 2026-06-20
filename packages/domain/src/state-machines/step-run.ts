import { defineMachine } from "./machine.js";

// No `leased` state by design: Otomat is a single-writer supervisor, not a
// scheduler.
export const STEP_RUN_STATES = [
  "queued",
  "starting",
  "running",
  "awaiting_permission",
  "awaiting_human",
  "succeeded",
  "failed",
  "canceled",
  "stale",
] as const;

export type StepRunState = (typeof STEP_RUN_STATES)[number];

export const stepRunMachine = defineMachine<StepRunState>({
  name: "step_run",
  initial: "queued",
  transitions: {
    queued: ["starting", "canceled"],
    starting: ["running", "failed", "canceled", "stale"],
    running: ["awaiting_permission", "awaiting_human", "succeeded", "failed", "canceled", "stale"],
    awaiting_permission: ["running", "failed", "canceled", "stale"],
    awaiting_human: ["running", "failed", "canceled", "stale"],
    succeeded: [],
    failed: [],
    canceled: [],
    stale: [],
  },
});
