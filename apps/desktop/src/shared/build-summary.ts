import type { DesktopBuildSummary } from "@otomat/domain";

/** Guards the synchronous build handshake the preload performs before exposing the bridge. */
export function isDesktopBuildSummary(value: unknown): value is DesktopBuildSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return (
    typeof summary.version === "string" &&
    typeof summary.commit === "string" &&
    typeof summary.channel === "string"
  );
}
