import { defineMachine } from "./machine.js";

// Intentionally has no terminal state: a resolved review can always be reopened
// (resolved -> in_review). The review lifecycle terminates with its parent
// run/PR, which do have terminal states.
export const REVIEW_STATES = ["open", "in_review", "changes_requested", "resolved"] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export const reviewMachine = defineMachine<ReviewState>({
  name: "review",
  initial: "open",
  transitions: {
    open: ["in_review"],
    in_review: ["changes_requested", "resolved"],
    changes_requested: ["in_review", "resolved"],
    resolved: ["in_review"],
  },
});
