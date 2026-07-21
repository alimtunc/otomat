import type { LinearVaultOperationResult } from "@otomat/domain";
import { contextBridge, ipcRenderer } from "electron";

import {
  DAEMON_URL_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";

// Resolved synchronously so `window.otomat.daemonUrl` exists before the client module reads it.
const daemonUrl: unknown = ipcRenderer.sendSync(DAEMON_URL_CHANNEL);
if (typeof daemonUrl !== "string") throw new Error("Invalid daemon URL from the main process");

contextBridge.exposeInMainWorld("otomat", {
  daemonUrl,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(PICK_DIRECTORY_CHANNEL),
  linear: {
    saveKey: (apiKey: string): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_SAVE_KEY_CHANNEL, apiKey),
    forgetKey: (): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_FORGET_KEY_CHANNEL),
  },
});
