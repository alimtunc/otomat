import { BrowserWindow, dialog, ipcMain } from "electron";

import { DAEMON_URL_CHANNEL, PICK_DIRECTORY_CHANNEL } from "#shared/ipc-channels";

/** Mutable holder so the sync handler always returns the URL resolved by the last successful daemon start. */
export interface IpcState {
  daemonUrl: string;
}

/**
 * The entire renderer↔main contract: a synchronous read of the daemon origin (the cockpit needs
 * it before its client module initializes) and a native directory chooser. No generic filesystem
 * or process access is exposed.
 */
export function registerIpc(state: IpcState): void {
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
}
