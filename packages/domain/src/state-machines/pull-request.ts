import { defineMachine } from "./machine.js";

export const PULL_REQUEST_STATES = ["draft", "open", "merged", "closed"] as const;

export type PullRequestState = (typeof PULL_REQUEST_STATES)[number];

export const pullRequestMachine = defineMachine<PullRequestState>({
  name: "pull_request",
  initial: "draft",
  transitions: {
    draft: ["open", "closed"],
    open: ["merged", "closed", "draft"],
    merged: [],
    closed: ["open"],
  },
});
