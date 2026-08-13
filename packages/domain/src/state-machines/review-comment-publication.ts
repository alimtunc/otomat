import { defineMachine } from "./machine.js";

// `local` is where an Otomat comment stays for good; only a PR-review comment walks the rest.
export const REVIEW_COMMENT_PUBLICATION_STATES = [
  "local",
  "pending",
  "published",
  "failed",
] as const;

export type ReviewCommentPublicationState = (typeof REVIEW_COMMENT_PUBLICATION_STATES)[number];

export const reviewCommentPublicationMachine = defineMachine<ReviewCommentPublicationState>({
  name: "review_comment_publication",
  initial: "local",
  transitions: {
    local: ["pending"],
    pending: ["published", "failed"],
    published: [],
    failed: ["pending"],
  },
});
