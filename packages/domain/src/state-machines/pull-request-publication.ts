import { defineMachine } from "./machine.js";

export const PULL_REQUEST_PUBLICATION_STATES = [
  "not_configured",
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
    not_configured: ["pushing", "created", "failed"],
    pushing: ["creating", "created", "failed"],
    creating: ["created", "failed"],
    created: ["pushing", "failed", "not_configured"],
    failed: ["pushing", "created", "not_configured"],
  },
});
