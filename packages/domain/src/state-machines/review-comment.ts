import { defineMachine } from "./machine.js";

// Anchors are immutable: a comment is addressed by a fix or goes stale when the diff moves — both terminal, never migrated.
export const REVIEW_COMMENT_STATES = ["open", "addressed", "outdated"] as const;

export type ReviewCommentState = (typeof REVIEW_COMMENT_STATES)[number];

export const reviewCommentMachine = defineMachine<ReviewCommentState>({
  name: "review_comment",
  initial: "open",
  transitions: {
    open: ["addressed", "outdated"],
    addressed: [],
    outdated: [],
  },
});
