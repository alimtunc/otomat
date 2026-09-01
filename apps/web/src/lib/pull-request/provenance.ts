import type { PullRequestProvenance } from "@otomat/domain";

/** How a provenance reads in one chip: it names who owns the branch, never who authored it — the author is a fact of its own. */
export const PULL_REQUEST_PROVENANCE_LABEL = {
  otomat: "Otomat",
  external: "External",
  unknown: "Owner unverified",
} satisfies Record<PullRequestProvenance, string>;

/** Only Otomat's own work is neutral; anything Otomat may not rewrite reads as a warning. */
export const PULL_REQUEST_PROVENANCE_TONE = {
  otomat: "neutral",
  external: "warning",
  unknown: "warning",
} satisfies Record<PullRequestProvenance, "neutral" | "warning">;
