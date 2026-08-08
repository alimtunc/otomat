import type {
  ErrorDiagnostic,
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostProjectsEntry,
  ExecutionHostRegisterProjectResult,
  ExecutionHostSnapshot,
  LinearDeliverySnapshot,
  LinearVaultOperationResult,
  OtomatDesktopBridge,
  PreviewSandboxResetResult,
  ProblemReportDraft,
  RemoteHostStatus,
  RemoteInstanceListResult,
  RemoteRepositoryListResult,
  SupportBundleExportResult,
} from "@otomat/domain";
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { isDesktopBuildSummary } from "#shared/build-summary";
import { isExecutionHostSync } from "#shared/execution-host-sync";
import {
  BUILD_SYNC_CHANNEL,
  DAEMON_URL_CHANNEL,
  EXECUTION_HOST_ALIASES_CHANNEL,
  EXECUTION_HOST_CONFIGURE_CHANNEL,
  EXECUTION_HOST_DELETE_INSTANCE_CHANNEL,
  EXECUTION_HOST_INSTANCES_CHANNEL,
  EXECUTION_HOST_PROJECTS_CHANNEL,
  EXECUTION_HOST_REGISTER_PROJECT_CHANNEL,
  EXECUTION_HOST_REMOVE_CHANNEL,
  EXECUTION_HOST_REPOSITORIES_CHANNEL,
  EXECUTION_HOST_SELECT_CHANNEL,
  EXECUTION_HOST_SNAPSHOT_CHANNEL,
  EXECUTION_HOST_STATUS_CHANNEL,
  EXECUTION_HOST_STOP_INSTANCE_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  EXECUTION_HOST_UPDATE_DAEMON_CHANNEL,
  LINEAR_DELIVERY_CHANNEL,
  LINEAR_DELIVERY_STATUS_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
  PREVIEW_SANDBOX_RESET_CHANNEL,
  PREVIEW_SYNC_CHANNEL,
  SUPPORT_EXPORT_CHANNEL,
  SUPPORT_REPORT_DRAFT_CHANNEL,
} from "#shared/ipc-channels";

// Resolved synchronously so `window.otomat.daemonUrl` exists before the client module reads it.
const daemonUrl: unknown = ipcRenderer.sendSync(DAEMON_URL_CHANNEL);
if (typeof daemonUrl !== "string") throw new Error("Invalid daemon URL from the main process");

const hostSync: unknown = ipcRenderer.sendSync(EXECUTION_HOST_SYNC_CHANNEL);
if (!isExecutionHostSync(hostSync)) {
  throw new Error("Invalid execution-host state from the main process");
}

const preview: unknown = ipcRenderer.sendSync(PREVIEW_SYNC_CHANNEL);
if (typeof preview !== "boolean") {
  throw new Error("Invalid preview flag from the main process");
}

const buildSummary: unknown = ipcRenderer.sendSync(BUILD_SYNC_CHANNEL);
if (!isDesktopBuildSummary(buildSummary)) {
  throw new Error("Invalid build metadata from the main process");
}

contextBridge.exposeInMainWorld("otomat", {
  daemonUrl,
  executionHostId: hostSync.id,
  executionHostSshAlias: hostSync.ssh_alias,
  build: buildSummary,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(PICK_DIRECTORY_CHANNEL),
  executionHost: {
    snapshot: (): Promise<ExecutionHostSnapshot> =>
      ipcRenderer.invoke(EXECUTION_HOST_SNAPSHOT_CHANNEL),
    select: (id: ExecutionHostId): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_SELECT_CHANNEL, id),
    configureRemote: (sshAlias: string): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_CONFIGURE_CHANNEL, sshAlias),
    removeRemote: (): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_REMOVE_CHANNEL),
    registerProject: (
      hostId: ExecutionHostId,
      path: string,
    ): Promise<ExecutionHostRegisterProjectResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_REGISTER_PROJECT_CHANNEL, hostId, path),
    listSshAliases: (): Promise<string[]> => ipcRenderer.invoke(EXECUTION_HOST_ALIASES_CHANNEL),
    listRemoteRepositories: (): Promise<RemoteRepositoryListResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_REPOSITORIES_CHANNEL),
    listProjects: (): Promise<ExecutionHostProjectsEntry[]> =>
      ipcRenderer.invoke(EXECUTION_HOST_PROJECTS_CHANNEL),
    onRemoteStatus: (listener: (status: RemoteHostStatus) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, status: RemoteHostStatus): void =>
        listener(status);
      ipcRenderer.on(EXECUTION_HOST_STATUS_CHANNEL, wrapped);
      return () => ipcRenderer.off(EXECUTION_HOST_STATUS_CHANNEL, wrapped);
    },
    listInstances: (): Promise<RemoteInstanceListResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_INSTANCES_CHANNEL),
    stopInstance: (build: string): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_STOP_INSTANCE_CHANNEL, build),
    deleteInstance: (build: string): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_DELETE_INSTANCE_CHANNEL, build),
    updateRemoteDaemon: (): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_UPDATE_DAEMON_CHANNEL),
  },
  linear: {
    saveKey: (apiKey: string): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_SAVE_KEY_CHANNEL, apiKey),
    forgetKey: (): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_FORGET_KEY_CHANNEL),
    delivery: (): Promise<LinearDeliverySnapshot> => ipcRenderer.invoke(LINEAR_DELIVERY_CHANNEL),
    onDelivery: (listener: (snapshot: LinearDeliverySnapshot) => void): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, snapshot: LinearDeliverySnapshot): void =>
        listener(snapshot);
      ipcRenderer.on(LINEAR_DELIVERY_STATUS_CHANNEL, wrapped);
      return () => ipcRenderer.off(LINEAR_DELIVERY_STATUS_CHANNEL, wrapped);
    },
  },
  support: {
    exportBundle: (diagnostic: ErrorDiagnostic): Promise<SupportBundleExportResult> =>
      ipcRenderer.invoke(SUPPORT_EXPORT_CHANNEL, diagnostic),
    openReportDraft: (draft: ProblemReportDraft): Promise<void> =>
      ipcRenderer.invoke(SUPPORT_REPORT_DRAFT_CHANNEL, draft),
  },
  preview,
  sandbox: {
    reset: (): Promise<PreviewSandboxResetResult> =>
      ipcRenderer.invoke(PREVIEW_SANDBOX_RESET_CHANNEL),
  },
} satisfies OtomatDesktopBridge);
