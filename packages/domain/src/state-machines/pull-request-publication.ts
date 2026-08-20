import { defineMachine } from "./machine.js";

export const PULL_REQUEST_PUBLICATION_STATES = [
  "not_configured",
  "generating",
  "committing",
  "pushing",
  "creating",
  "created",
  "failed",
] as const;

export type PullRequestPublicationState = (typeof PULL_REQUEST_PUBLICATION_STATES)[number];

export const pullRequestPublicationMachine = defineMachine<PullRequestPublicationState>({
  name: "pull_request_publication",
  initial: "not_configured",
  transitions: {
    not_configured: ["generating", "committing", "creating", "pushing", "created", "failed"],
    generating: ["committing", "creating", "not_configured", "failed"],
    committing: ["pushing", "not_configured", "failed"],
    pushing: ["creating", "created", "failed"],
    creating: ["created", "not_configured", "failed"],
    created: ["generating", "committing", "creating", "pushing", "not_configured", "failed"],
    failed: ["generating", "committing", "creating", "pushing", "created", "not_configured"],
  },
});

/** Phases a daemon is working through; a row resting on one after a restart is an interrupted operation, not a state. */
export const PULL_REQUEST_PUBLICATION_ACTIVE_STATES = [
  "generating",
  "committing",
  "pushing",
  "creating",
] as const satisfies readonly PullRequestPublicationState[];
export type PullRequestPublicationActiveState =
  (typeof PULL_REQUEST_PUBLICATION_ACTIVE_STATES)[number];

const activeSet: ReadonlySet<string> = new Set(PULL_REQUEST_PUBLICATION_ACTIVE_STATES);

export function isPullRequestPublicationActive(
  status: string,
): status is PullRequestPublicationActiveState {
  return activeSet.has(status);
}
