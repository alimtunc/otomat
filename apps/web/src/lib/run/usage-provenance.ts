import type { UsageAvailability } from "@otomat/domain";

/** Said next to a number so a still-moving total is never read as a settled one. */
export const USAGE_PROVENANCE = {
  live: "live",
  final: "final",
  unavailable: "not reported",
} satisfies Record<UsageAvailability, string>;
