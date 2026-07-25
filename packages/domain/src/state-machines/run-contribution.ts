import { defineMachine } from "./machine.js";

export const RUN_CONTRIBUTION_STATES = ["queued", "sent", "completed", "failed"] as const;

export type RunContributionState = (typeof RUN_CONTRIBUTION_STATES)[number];

/** `sent` requires persisted evidence that a turn carrying the message was launched, so it is never reached from a UI click. */
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

/** A failed message is retriable only while nothing was ever handed to the provider. */
export function isRunContributionRetriable(contribution: {
  status: RunContributionState;
  delivered_at: string | null;
}): boolean {
  return contribution.status === "failed" && contribution.delivered_at === null;
}
