import type { DaemonEndpoint } from "@otomat/client";
import { app } from "electron";

import { BackgroundMode, type BackgroundModeOptions } from "./controller.js";
import { askCloseChoice } from "./prompts.js";
import { readLocalWork } from "./read-work.js";
import { BackgroundTray } from "./tray.js";

export function createBackgroundMode({
  trayIcon,
  appIcon,
  daemon,
  ...shell
}: Pick<BackgroundModeOptions, "hideWindow" | "openWindow" | "openRun" | "log"> & {
  trayIcon(): string;
  appIcon(): string;
  daemon(): DaemonEndpoint | null;
}): BackgroundMode {
  return new BackgroundMode({
    ...shell,
    readWork: () => readLocalWork(daemon()),
    askCloseChoice: (items) => askCloseChoice(items, appIcon()),
    createTray: (actions) => new BackgroundTray(trayIcon(), actions),
    quit: () => app.quit(),
  });
}
