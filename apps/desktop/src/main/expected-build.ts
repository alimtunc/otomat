import { spawnSync } from "node:child_process";

import { app } from "electron";

import type { BuildInfo } from "#shared/build-info";

/**
 * The daemon build this app expects on every host: the packaged commit, or the
 * dev checkout's HEAD. Null when neither is identifiable — comparisons are then
 * skipped rather than guessed.
 */
export function resolveExpectedBuild(
  info: BuildInfo,
  log: (message: string) => void,
): string | null {
  if (info.commit_short !== "unknown") return info.commit_short;
  try {
    const result = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: app.getAppPath(),
      encoding: "utf8",
    });
    if (result.status !== 0) return null;
    const sha = result.stdout.trim();
    // Sliced to 7 to match both the packaged commit_short and the daemon's baked sha.
    return sha === "" ? null : sha.slice(0, 7);
  } catch (error) {
    log(`Expected build could not be resolved: ${String(error)}`);
    return null;
  }
}
