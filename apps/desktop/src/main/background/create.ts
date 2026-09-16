import { app } from "electron";

import { BackgroundMode, type BackgroundModeOptions } from "./controller.js";
import { askCloseChoice } from "./prompts.js";
import { readLocalWork } from "./read-work.js";
import { BackgroundTray } from "./tray.js";

export function createBackgroundMode({
  trayIcon,
  appIcon,
  daemonUrl,
  daemonFetch,
  ...shell
}: Pick<BackgroundModeOptions, "hideWindow" | "openWindow" | "openRun" | "log"> & {
  trayIcon(): string;
  appIcon(): string;
  daemonUrl(): string;
  daemonFetch: typeof fetch;
}): BackgroundMode {
  return new BackgroundMode({
    ...shell,
    readWork: () => readLocalWork(daemonUrl(), daemonFetch),
    askCloseChoice: (items) => askCloseChoice(items, appIcon()),
    createTray: (actions) => new BackgroundTray(trayIcon(), actions),
    quit: () => app.quit(),
  });
}
