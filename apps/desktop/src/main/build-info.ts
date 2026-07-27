import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";

import { developmentBuildInfo, parseBuildInfo, type BuildInfo } from "#shared/build-info";

/** Packaging writes `build-info.json` beside the main bundle; a checkout run has no artifact. */
export function readBuildInfo(): BuildInfo {
  if (!app.isPackaged) {
    return developmentBuildInfo(app.getVersion(), process.versions.electron ?? "unknown");
  }
  return parseBuildInfo(readFileSync(join(app.getAppPath(), "build-info.json"), "utf8"));
}
