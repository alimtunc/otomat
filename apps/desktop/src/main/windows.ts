import { BrowserWindow } from "electron";

import { APP_START_URL } from "#shared/constants";

import type { AppPaths } from "./paths.js";

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

/** Small frameless window shown immediately while the daemon boots; it never touches the daemon. */
export async function createSplashWindow(paths: AppPaths): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 460,
    height: 420,
    resizable: false,
    frame: false,
    title: "Otomat",
    backgroundColor: "#0b0b0e",
    webPreferences: { ...SECURE_WEB_PREFERENCES, preload: paths.splashPreload },
  });
  await window.loadFile(paths.splashHtml);
  return window;
}

/** The cockpit window, created only after the daemon is healthy. `startUrl` is the Vite dev server in dev, else the app scheme. */
export function createCockpitWindow(paths: AppPaths, startUrl: string | null): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: "Otomat",
    backgroundColor: "#0b0b0e",
    webPreferences: { ...SECURE_WEB_PREFERENCES, preload: paths.cockpitPreload },
  });
  window.once("ready-to-show", () => window.show());
  void window.loadURL(startUrl ?? APP_START_URL);
  return window;
}
