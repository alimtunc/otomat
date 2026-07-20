import { BrowserWindow, dialog, ipcMain } from "electron";

import {
  DAEMON_URL_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  LINEAR_VAULT_STATUS_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";
import { clearLinearKey, pushLinearKey } from "#shared/linear-handoff";
import type { LinearVault, LinearVaultStatus } from "#shared/linear-vault";

/** Mutable holder so the sync handler always returns the URL resolved by the last successful daemon start. */
export interface IpcState {
  daemonUrl: string;
}

/** What the renderer gets back from a save attempt; the key itself is never echoed. */
export interface LinearSaveResult {
  ok: boolean;
  message: string | null;
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : "Saving the Linear key failed.";
}

/**
 * The entire renderer↔main contract: a synchronous read of the daemon origin (the cockpit needs
 * it before its client module initializes), a native directory chooser, and the Linear key vault.
 * No generic filesystem or process access is exposed, and no channel can read a stored key back —
 * the key only ever moves forward, from the renderer into safeStorage and on to the daemon.
 */
export function registerIpc(state: IpcState, vault: LinearVault): void {
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

  ipcMain.handle(LINEAR_VAULT_STATUS_CHANNEL, (): LinearVaultStatus => vault.status());

  ipcMain.handle(
    LINEAR_SAVE_KEY_CHANNEL,
    async (_event, apiKey: unknown): Promise<LinearSaveResult> => {
      if (typeof apiKey !== "string" || apiKey.trim() === "") {
        return { ok: false, message: "Provide a Linear Personal API key." };
      }
      try {
        // The daemon validates the key before it is persisted, so a rejected key
        // never lands in the vault.
        await pushLinearKey({ daemonUrl: state.daemonUrl, apiKey });
        vault.save(apiKey);
        return { ok: true, message: null };
      } catch (error) {
        return { ok: false, message: describeFailure(error) };
      }
    },
  );

  ipcMain.handle(LINEAR_FORGET_KEY_CHANNEL, async (): Promise<LinearSaveResult> => {
    vault.clear();
    try {
      await clearLinearKey(state.daemonUrl);
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: describeFailure(error) };
    }
  });
}
