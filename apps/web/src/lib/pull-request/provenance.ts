import type { PullRequestProvenance } from "@otomat/domain";

/** How a provenance reads in one chip: `unknown` is stated, never softened into "yours". */
export const PROVENANCE_LABEL = {
  otomat: "Otomat",
  external: "External",
  unknown: "Unknown author",
} satisfies Record<PullRequestProvenance, string>;

/** Only Otomat's own work is neutral; anything Otomat may not rewrite reads as a warning. */
export const PROVENANCE_TONE = {
  otomat: "neutral",
  external: "warning",
  unknown: "warning",
} satisfies Record<PullRequestProvenance, "neutral" | "warning">;
