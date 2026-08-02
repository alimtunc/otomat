import { spawnSync } from "node:child_process";

import { app } from "electron";

import { readBuildInfo } from "./build-info.js";

/**
 * The daemon build this app expects on every host: the packaged commit, or the
 * dev checkout's HEAD. Null when neither is identifiable — comparisons are then
 * skipped rather than guessed.
 */
export function resolveExpectedBuild(log: (message: string) => void): string | null {
  try {
    const info = readBuildInfo(log);
    if (info.commit_short !== "unknown") return info.commit_short;
    const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: app.getAppPath(),
      encoding: "utf8",
    });
    if (result.status !== 0) return null;
    const sha = result.stdout.trim();
    return sha === "" ? null : sha;
  } catch (error) {
    log(`Expected build could not be resolved: ${String(error)}`);
    return null;
  }
}
