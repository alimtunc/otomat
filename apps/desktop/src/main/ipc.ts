import type { LinearVaultOperationResult, PreviewSandboxResetResult } from "@otomat/domain";
import { BrowserWindow, dialog, ipcMain } from "electron";

import {
  DAEMON_URL_CHANNEL,
  EXECUTION_HOST_ALIASES_CHANNEL,
  EXECUTION_HOST_CONFIGURE_CHANNEL,
  EXECUTION_HOST_PROJECTS_CHANNEL,
  EXECUTION_HOST_REGISTER_PROJECT_CHANNEL,
  EXECUTION_HOST_REMOVE_CHANNEL,
  EXECUTION_HOST_SELECT_CHANNEL,
  EXECUTION_HOST_SNAPSHOT_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
  PREVIEW_SANDBOX_RESET_CHANNEL,
  PREVIEW_SYNC_CHANNEL,
} from "#shared/ipc-channels";
import {
  SPLASH_EXPORT_SUPPORT_CHANNEL,
  SPLASH_RESTORE_CHANNEL,
  SPLASH_SHOW_POLICY_CHANNEL,
} from "#shared/startup";

import type { ExecutionHostIpcActions } from "./remote/ipc-actions.js";

/** Mutable holder so the sync handler always returns the URL resolved by the last successful daemon start. */
export interface IpcState {
  daemonUrl: string;
  /** True for a packaged preview build; static per process. */
  preview: boolean;
}

export interface IpcActions {
  saveLinearKey(apiKey: unknown): Promise<LinearVaultOperationResult>;
  forgetLinearKey(): Promise<LinearVaultOperationResult>;
  restoreBackup(): Promise<void>;
  exportSupportBundle(): Promise<void>;
  showDataPolicy(): Promise<void>;
  resetSandbox(): Promise<PreviewSandboxResetResult>;
  executionHost: ExecutionHostIpcActions;
}

export function registerIpc(state: IpcState, actions: IpcActions): void {
  ipcMain.on(DAEMON_URL_CHANNEL, (event) => {
    event.returnValue = state.daemonUrl;
  });

  ipcMain.on(PREVIEW_SYNC_CHANNEL, (event) => {
    event.returnValue = state.preview;
  });

  ipcMain.on(EXECUTION_HOST_SYNC_CHANNEL, (event) => {
    event.returnValue = actions.executionHost.sync();
  });

  ipcMain.handle(PREVIEW_SANDBOX_RESET_CHANNEL, () => actions.resetSandbox());

  ipcMain.handle(EXECUTION_HOST_SNAPSHOT_CHANNEL, () => actions.executionHost.snapshot());
  ipcMain.handle(EXECUTION_HOST_SELECT_CHANNEL, (_event, id: unknown) =>
    actions.executionHost.select(id),
  );
  ipcMain.handle(EXECUTION_HOST_CONFIGURE_CHANNEL, (_event, sshAlias: unknown) =>
    actions.executionHost.configureRemote(sshAlias),
  );
  ipcMain.handle(EXECUTION_HOST_REMOVE_CHANNEL, () => actions.executionHost.removeRemote());
  ipcMain.handle(
    EXECUTION_HOST_REGISTER_PROJECT_CHANNEL,
    (_event, hostId: unknown, path: unknown) => actions.executionHost.registerProject(hostId, path),
  );
  ipcMain.handle(EXECUTION_HOST_ALIASES_CHANNEL, () => actions.executionHost.listAliases());
  ipcMain.handle(EXECUTION_HOST_PROJECTS_CHANNEL, () => actions.executionHost.listProjects());

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
