import { defineMachine } from "./machine.js";

export const RUN_CONTRIBUTION_STATES = ["queued", "sent", "completed", "failed"] as const;

export type RunContributionState = (typeof RUN_CONTRIBUTION_STATES)[number];

/**
 * A user message on a run. `sent` requires persisted evidence that a turn
 * carrying it was launched, so it is never reached from a UI click. `failed`
 * re-queues only when nothing was ever delivered — a contribution the provider
 * already received must not be replayed.
 */
export const runContributionMachine = defineMachine<RunContributionState>({
  name: "run_contribution",
  initial: "queued",
  transitions: {
    queued: ["sent", "failed"],
    sent: ["completed", "failed"],
    completed: [],
    failed: ["queued"],
  },
});

/** States whose contribution still owes the run a delivery attempt. */
export function isRunContributionPending(status: RunContributionState): boolean {
  return status === "queued";
}
