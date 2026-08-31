import type { UsageAvailability } from "@otomat/domain";

/** Settled is the default and says nothing; only a still-moving or absent total gets a marker. */
export const USAGE_PROVENANCE = {
  live: "counting…",
  final: null,
  unavailable: "not reported",
} satisfies Record<UsageAvailability, string | null>;
