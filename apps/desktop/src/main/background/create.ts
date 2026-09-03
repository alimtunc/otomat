import { app } from "electron";

import { BackgroundMode, type BackgroundModeOptions } from "./controller.js";
import { askCloseChoice, confirmQuit } from "./prompts.js";
import { readLocalWork } from "./read-work.js";
import { BackgroundTray } from "./tray.js";

export function createBackgroundMode({
  trayIcon,
  daemonUrl,
  ...shell
}: Pick<BackgroundModeOptions, "hideWindow" | "openWindow" | "log"> & {
  trayIcon(): string;
  daemonUrl(): string;
}): BackgroundMode {
  return new BackgroundMode({
    ...shell,
    readWork: () => readLocalWork(daemonUrl()),
    askCloseChoice,
    confirmQuit,
    createTray: (actions) => new BackgroundTray(trayIcon(), actions),
    quit: () => app.quit(),
  });
}
