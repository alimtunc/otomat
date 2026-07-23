import type { LinearVaultOperationResult } from "@otomat/domain";
import { BrowserWindow, dialog, ipcMain } from "electron";

import {
  DAEMON_URL_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";
import {
  SPLASH_EXPORT_SUPPORT_CHANNEL,
  SPLASH_RESTORE_CHANNEL,
  SPLASH_SHOW_POLICY_CHANNEL,
} from "#shared/startup";

/** Mutable holder so the sync handler always returns the URL resolved by the last successful daemon start. */
export interface IpcState {
  daemonUrl: string;
}

export interface IpcActions {
  saveLinearKey(apiKey: unknown): Promise<LinearVaultOperationResult>;
  forgetLinearKey(): Promise<LinearVaultOperationResult>;
  restoreBackup(): Promise<void>;
  exportSupportBundle(): Promise<void>;
  showDataPolicy(): Promise<void>;
}

export function registerIpc(state: IpcState, actions: IpcActions): void {
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

  ipcMain.handle(LINEAR_SAVE_KEY_CHANNEL, (_event, apiKey: unknown) =>
    actions.saveLinearKey(apiKey),
  );

  ipcMain.handle(LINEAR_FORGET_KEY_CHANNEL, () => actions.forgetLinearKey());
  ipcMain.handle(SPLASH_RESTORE_CHANNEL, () => actions.restoreBackup());
  ipcMain.handle(SPLASH_EXPORT_SUPPORT_CHANNEL, () => actions.exportSupportBundle());
  ipcMain.handle(SPLASH_SHOW_POLICY_CHANNEL, () => actions.showDataPolicy());
}
