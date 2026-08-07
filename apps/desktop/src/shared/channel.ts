/**
 * Channel a packaged build declares in `build-info.json`. Packaging states it explicitly; it is
 * never inferred from the signature, which is a separate trust property (a `stable` build that is
 * not Developer ID signed is invalid metadata, not a preview).
 */
export type PackagedChannel = "preview" | "local" | "stable";

/**
 * Channel the running app is on: one a build declared, a dev checkout, or `unknown` — a packaged
 * build whose metadata is missing or invalid, which stays in its own isolated location.
 */
export type DesktopChannel = PackagedChannel | "dev" | "unknown";

export const PACKAGED_CHANNELS: readonly PackagedChannel[] = ["preview", "local", "stable"];

export function isPackagedChannel(value: unknown): value is PackagedChannel {
  return typeof value === "string" && (PACKAGED_CHANNELS as readonly string[]).includes(value);
}
