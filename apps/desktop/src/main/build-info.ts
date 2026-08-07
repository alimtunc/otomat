import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import {
  devBuildInfo,
  parseBuildInfo,
  unidentifiedBuildInfo,
  type BuildInfo,
} from "#shared/build-info";

/**
 * Packaging writes `build-info.json` beside the main bundle. Unreadable metadata degrades to an
 * unidentified build — the `unknown` channel, isolated from every other channel's data — instead
 * of failing startup or guessing which channel this artifact belongs to.
 */
export function readBuildInfo(log: (message: string) => void): BuildInfo {
  const electron = process.versions.electron ?? "unknown";
  if (!app.isPackaged) return devBuildInfo(app.getVersion(), electron);
  try {
    return parseBuildInfo(readFileSync(join(app.getAppPath(), "build-info.json"), "utf8"));
  } catch (error) {
    log(`Build metadata could not be read: ${error instanceof Error ? error.message : "unknown"}`);
    return unidentifiedBuildInfo(app.getVersion(), electron);
  }
}
