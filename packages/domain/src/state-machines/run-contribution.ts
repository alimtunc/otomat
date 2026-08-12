import { defineMachine } from "./machine.js";

export const RUN_CONTRIBUTION_STATES = [
  "queued",
  "delivered",
  "acknowledged",
  "failed",
  "canceled",
] as const;

export type RunContributionState = (typeof RUN_CONTRIBUTION_STATES)[number];

/** `delivered` requires persisted evidence that a turn carrying the message was launched, so it is never reached from a UI click. */
export const runContributionMachine = defineMachine<RunContributionState>({
  name: "run_contribution",
  initial: "queued",
  transitions: {
    queued: ["delivered", "failed", "canceled"],
    delivered: ["acknowledged", "failed"],
    acknowledged: [],
    failed: ["queued", "canceled"],
    canceled: [],
  },
});

interface RunContributionDelivery {
  status: RunContributionState;
  agent_session_id: string | null;
  delivered_at: string | null;
}

/** A failed message is retriable only while nothing was ever handed to the provider. */
export function isRunContributionRetriable(contribution: {
  status: RunContributionState;
  delivered_at: string | null;
}): boolean {
  return contribution.status === "failed" && contribution.delivered_at === null;
}

/** Withdrawable only before a turn claims it: a claimed batch may already be reaching the provider. */
export function isRunContributionCancelable(contribution: RunContributionDelivery): boolean {
  if (contribution.delivered_at !== null || contribution.agent_session_id !== null) return false;
  return contribution.status === "queued" || contribution.status === "failed";
}
