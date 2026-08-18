import type { PullRequestProvenance } from "@otomat/domain";

/** How a provenance reads in one chip: `unknown` is stated, never softened into "yours". */
export const PROVENANCE_LABEL: Record<PullRequestProvenance, string> = {
  otomat: "Otomat",
  external: "External",
  unknown: "Unknown author",
};

/** Only Otomat's own work is neutral; anything Otomat may not rewrite reads as a warning. */
export const PROVENANCE_TONE: Record<PullRequestProvenance, "neutral" | "warning"> = {
  otomat: "neutral",
  external: "warning",
  unknown: "warning",
};
