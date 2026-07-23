import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  SPLASH_EXPORT_SUPPORT_CHANNEL,
  SPLASH_RESTORE_CHANNEL,
  SPLASH_RETRY_CHANNEL,
  SPLASH_SHOW_POLICY_CHANNEL,
  SPLASH_STATUS_CHANNEL,
  type StartupStatus,
} from "#shared/startup";

contextBridge.exposeInMainWorld("otomatSplash", {
  onStatus: (callback: (status: StartupStatus) => void): void => {
    ipcRenderer.on(SPLASH_STATUS_CHANNEL, (_event: IpcRendererEvent, status: StartupStatus) =>
      callback(status),
    );
  },
  retry: (): void => ipcRenderer.send(SPLASH_RETRY_CHANNEL),
  restore: (): Promise<void> => ipcRenderer.invoke(SPLASH_RESTORE_CHANNEL),
  exportSupportBundle: (): Promise<void> => ipcRenderer.invoke(SPLASH_EXPORT_SUPPORT_CHANNEL),
  showDataPolicy: (): Promise<void> => ipcRenderer.invoke(SPLASH_SHOW_POLICY_CHANNEL),
});
