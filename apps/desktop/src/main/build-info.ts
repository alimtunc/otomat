import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import { parseBuildInfo, unidentifiedBuildInfo, type BuildInfo } from "#shared/build-info";

/**
 * Packaging writes `build-info.json` beside the main bundle. Unreadable metadata degrades to an
 * unidentified build instead of failing its only caller, the support bundle.
 */
export function readBuildInfo(log: (message: string) => void): BuildInfo {
  const electron = process.versions.electron ?? "unknown";
  if (!app.isPackaged) return unidentifiedBuildInfo(app.getVersion(), electron);
  try {
    return parseBuildInfo(readFileSync(join(app.getAppPath(), "build-info.json"), "utf8"));
  } catch (error) {
    log(`Build metadata could not be read: ${error instanceof Error ? error.message : "unknown"}`);
    return unidentifiedBuildInfo(app.getVersion(), electron);
  }
}
