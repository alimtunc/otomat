import type {
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostSnapshot,
  LinearVaultOperationResult,
  OtomatDesktopBridge,
  RemoteHostStatus,
} from "@otomat/domain";
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  DAEMON_URL_CHANNEL,
  EXECUTION_HOST_ALIASES_CHANNEL,
  EXECUTION_HOST_CONFIGURE_CHANNEL,
  EXECUTION_HOST_SELECT_CHANNEL,
  EXECUTION_HOST_SNAPSHOT_CHANNEL,
  EXECUTION_HOST_STATUS_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
} from "#shared/ipc-channels";

// Resolved synchronously so `window.otomat.daemonUrl` exists before the client module reads it.
const daemonUrl: unknown = ipcRenderer.sendSync(DAEMON_URL_CHANNEL);
if (typeof daemonUrl !== "string") throw new Error("Invalid daemon URL from the main process");

const hostSync: unknown = ipcRenderer.sendSync(EXECUTION_HOST_SYNC_CHANNEL);
if (
  typeof hostSync !== "object" ||
  hostSync === null ||
  !("id" in hostSync) ||
  (hostSync.id !== "local" && hostSync.id !== "remote") ||
  !("ssh_alias" in hostSync) ||
  (typeof hostSync.ssh_alias !== "string" && hostSync.ssh_alias !== null)
) {
  throw new Error("Invalid execution-host state from the main process");
}

contextBridge.exposeInMainWorld("otomat", {
  daemonUrl,
  executionHostId: hostSync.id,
  executionHostSshAlias: hostSync.ssh_alias,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(PICK_DIRECTORY_CHANNEL),
  executionHost: {
    snapshot: (): Promise<ExecutionHostSnapshot> =>
      ipcRenderer.invoke(EXECUTION_HOST_SNAPSHOT_CHANNEL),
    select: (id: ExecutionHostId): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_SELECT_CHANNEL, id),
    configureRemote: (sshAlias: string): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_CONFIGURE_CHANNEL, sshAlias),
    listSshAliases: (): Promise<string[]> => ipcRenderer.invoke(EXECUTION_HOST_ALIASES_CHANNEL),
    onRemoteStatus: (listener: (status: RemoteHostStatus) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: RemoteHostStatus): void =>
        listener(status);
      ipcRenderer.on(EXECUTION_HOST_STATUS_CHANNEL, wrapped);
      return () => ipcRenderer.off(EXECUTION_HOST_STATUS_CHANNEL, wrapped);
    },
  },
  linear: {
    saveKey: (apiKey: string): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_SAVE_KEY_CHANNEL, apiKey),
    forgetKey: (): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_FORGET_KEY_CHANNEL),
  },
} satisfies OtomatDesktopBridge);
