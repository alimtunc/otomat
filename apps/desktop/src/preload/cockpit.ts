import { contextBridge, ipcRenderer } from "electron";

import {
  DAEMON_URL_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  LINEAR_VAULT_STATUS_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";

// Resolved synchronously so `window.otomat.daemonUrl` is present before the cockpit's client
// module reads it. The narrow surface is the whole renderer→main contract: a daemon origin and
// a native directory chooser — no generic filesystem or process access.
const daemonUrl: unknown = ipcRenderer.sendSync(DAEMON_URL_CHANNEL);
if (typeof daemonUrl !== "string") throw new Error("Invalid daemon URL from the main process");

contextBridge.exposeInMainWorld("otomat", {
  daemonUrl,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(PICK_DIRECTORY_CHANNEL),
  // Write-only by construction: the renderer can store, forget, and ask whether a
  // key exists, but there is no channel that returns one.
  linear: {
    vaultStatus: (): Promise<unknown> => ipcRenderer.invoke(LINEAR_VAULT_STATUS_CHANNEL),
    saveKey: (apiKey: string): Promise<unknown> =>
      ipcRenderer.invoke(LINEAR_SAVE_KEY_CHANNEL, apiKey),
    forgetKey: (): Promise<unknown> => ipcRenderer.invoke(LINEAR_FORGET_KEY_CHANNEL),
  },
});
