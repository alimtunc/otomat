import type { PullRequestMergeMethod } from "@otomat/domain";

export const MERGE_METHOD_LABEL = {
  merge: "Merge",
  squash: "Squash and merge",
} satisfies Record<PullRequestMergeMethod, string>;
