import { contextBridge, ipcRenderer } from "electron";

import { DAEMON_URL_CHANNEL, PICK_DIRECTORY_CHANNEL } from "#shared/ipc-channels";

// Resolved synchronously so `window.otomat.daemonUrl` is present before the cockpit's client
// module reads it. The narrow surface is the whole renderer→main contract: a daemon origin and
// a native directory chooser — no generic filesystem or process access.
const daemonUrl: unknown = ipcRenderer.sendSync(DAEMON_URL_CHANNEL);
if (typeof daemonUrl !== "string") throw new Error("Invalid daemon URL from the main process");

contextBridge.exposeInMainWorld("otomat", {
  daemonUrl,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(PICK_DIRECTORY_CHANNEL),
});
