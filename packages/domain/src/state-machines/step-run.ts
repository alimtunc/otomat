import { defineMachine } from "./machine.js";

export const STEP_RUN_STATES = [
  "queued",
  "starting",
  "running",
  "awaiting_permission",
  "awaiting_human",
  "waiting_for_provider",
  "succeeded",
  "failed",
  "canceled",
  "stale",
  "withdrawn",
] as const;

export type StepRunState = (typeof STEP_RUN_STATES)[number];

/** A step that stopped without succeeding requeues on resume — its work is still owed. Two states are final: `succeeded`, since reopening it would replay delivered work, and `withdrawn`, the operator's cancel of a step that never started, which no resume owes back. */
export const stepRunMachine = defineMachine<StepRunState>({
  name: "step_run",
  initial: "queued",
  transitions: {
    queued: ["starting", "canceled", "withdrawn"],
    starting: ["running", "failed", "canceled", "stale"],
    running: [
      "awaiting_permission",
      "awaiting_human",
      "waiting_for_provider",
      "succeeded",
      "failed",
      "canceled",
      "stale",
    ],
    awaiting_permission: ["running", "failed", "canceled", "stale"],
    // Only an explicit decision — an operator override or a supervisor pass — closes a step from here.
    awaiting_human: ["running", "succeeded", "failed", "canceled", "stale"],
    waiting_for_provider: ["running", "failed", "canceled", "stale"],
    succeeded: [],
    failed: ["queued"],
    canceled: ["queued"],
    stale: ["queued"],
    withdrawn: [],
  },
});

/** Step states with no work in flight; a settle leaves them alone, and only an explicit resume requeues one. `waiting_for_provider` is deliberately out: a cancel or an abandon still has to be able to close a step waiting on a quota reset. */
export const STEP_RUN_SETTLED_STATES = [
  "succeeded",
  "failed",
  "canceled",
  "stale",
  "withdrawn",
] as const satisfies readonly StepRunState[];
export type StepRunSettledState = (typeof STEP_RUN_SETTLED_STATES)[number];

const stepSettledSet: ReadonlySet<string> = new Set(STEP_RUN_SETTLED_STATES);

export function isStepSettled(status: string): status is StepRunSettledState {
  return stepSettledSet.has(status);
}
