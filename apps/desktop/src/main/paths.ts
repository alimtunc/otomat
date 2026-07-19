import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "electron";

/** Directory of the built main entry: `dist/main` in both dev and the packaged asar. */
const MAIN_DIR = dirname(fileURLToPath(import.meta.url));

export interface AppPaths {
  packaged: boolean;
  /** Node entry for the daemon child process. */
  daemonEntry: string;
  /** Directory the packaged renderer is served from (index.html + assets); null in dev (Vite dev server). */
  webDist: string | null;
  splashHtml: string;
  cockpitPreload: string;
  splashPreload: string;
}

export function resolveAppPaths(): AppPaths {
  const cockpitPreload = join(MAIN_DIR, "..", "preload", "cockpit.cjs");
  const splashPreload = join(MAIN_DIR, "..", "preload", "splash.cjs");

  if (app.isPackaged) {
    // The daemon ships in `files` + asarUnpack (electron-builder's path for native modules), so it
    // lands as real files under app.asar.unpacked — spawnable and able to load better-sqlite3.
    const daemonDir = join(process.resourcesPath, "app.asar.unpacked", "daemon");
    return {
      packaged: true,
      daemonEntry: join(daemonDir, "dist", "index.js"),
      webDist: join(process.resourcesPath, "web"),
      splashHtml: join(app.getAppPath(), "resources", "splash.html"),
      cockpitPreload,
      splashPreload,
    };
  }

  // Dev: main lives at <repo>/apps/desktop/dist/main.
  const repoRoot = resolve(MAIN_DIR, "..", "..", "..", "..");
  return {
    packaged: false,
    daemonEntry: join(repoRoot, "apps", "local-daemon", "dist", "index.js"),
    webDist: null,
    splashHtml: join(MAIN_DIR, "..", "..", "resources", "splash.html"),
    cockpitPreload,
    splashPreload,
  };
}
