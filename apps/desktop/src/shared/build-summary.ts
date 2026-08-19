import type { DesktopBuildSummary } from "@otomat/domain";

/** Guards the synchronous build handshake the preload performs before exposing the bridge. */
export function isDesktopBuildSummary(value: unknown): value is DesktopBuildSummary {
  if (typeof value !== "object" || value === null) return false;
  return (
    "version" in value &&
    typeof value.version === "string" &&
    "commit" in value &&
    typeof value.commit === "string" &&
    "channel" in value &&
    typeof value.channel === "string"
  );
}
