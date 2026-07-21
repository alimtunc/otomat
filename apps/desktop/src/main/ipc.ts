import { BrowserWindow, dialog, ipcMain } from "electron";

import {
  DAEMON_URL_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";

import type { LinearCoordinator } from "./linear-coordinator.js";

/** Mutable holder so the sync handler always returns the URL resolved by the last successful daemon start. */
export interface IpcState {
  daemonUrl: string;
}

export function registerIpc(state: IpcState, linear: LinearCoordinator): void {
  ipcMain.on(DAEMON_URL_CHANNEL, (event) => {
    event.returnValue = state.daemonUrl;
  });

  ipcMain.handle(PICK_DIRECTORY_CHANNEL, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ["openDirectory", "createDirectory"],
    };
    const result = await (window === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(window, options));
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(LINEAR_SAVE_KEY_CHANNEL, (_event, apiKey: unknown) => linear.save(apiKey));

  ipcMain.handle(LINEAR_FORGET_KEY_CHANNEL, () => linear.forget());
}
