import type {
  DesktopUpdateSnapshot,
  ErrorDiagnostic,
  ExecutionHostCallResult,
  ExecutionHostCapacityResult,
  ExecutionHostId,
  ExecutionHostOperationResult,
  ExecutionHostProjectsEntry,
  ExecutionHostRegisterProjectResult,
  ExecutionHostRepositoriesEntry,
  ConnectLinearRequest,
  ExecutionHostSelectResult,
  ExecutionHostSnapshot,
  InboxSnapshot,
  LinearDeliverySnapshot,
  LinearVaultOperationResult,
  OtomatDesktopBridge,
  PreviewSandboxResetResult,
  ProblemReportDraft,
  ProjectHealthReport,
  RemoteHostStatus,
  RemoteInstanceListResult,
  RemoteRepositoryListResult,
  SupportBundleExportResult,
  WorkspaceCleanupResult,
  WorkspaceInventory,
  WorkspaceOpenTarget,
  WorkspaceReconcileReport,
} from "@otomat/domain";
import { contextBridge, ipcRenderer } from "electron";

import { isDesktopBuildSummary } from "#shared/build-summary";
import { isExecutionHostSync } from "#shared/execution-host-sync";
import {
  BUILD_SYNC_CHANNEL,
  DAEMON_URL_CHANNEL,
  EXECUTION_HOST_ALIASES_CHANNEL,
  EXECUTION_HOST_CATALOG_REPOSITORIES_CHANNEL,
  EXECUTION_HOST_CLEANUP_WORKSPACE_CHANNEL,
  EXECUTION_HOST_CONFIGURE_CHANNEL,
  EXECUTION_HOST_DELETE_INSTANCE_CHANNEL,
  EXECUTION_HOST_DELETE_REPOSITORY_CHANNEL,
  EXECUTION_HOST_INBOX_CHANNEL,
  EXECUTION_HOST_INSTANCES_CHANNEL,
  EXECUTION_HOST_OPEN_WORKSPACE_CHANNEL,
  EXECUTION_HOST_PROJECT_HEALTH_CHANNEL,
  EXECUTION_HOST_PROJECTS_CHANNEL,
  EXECUTION_HOST_READ_CAPACITY_CHANNEL,
  EXECUTION_HOST_RECONCILE_WORKSPACES_CHANNEL,
  EXECUTION_HOST_REGISTER_PROJECT_CHANNEL,
  EXECUTION_HOST_REMOVE_CHANNEL,
  EXECUTION_HOST_REPOSITORIES_CHANNEL,
  EXECUTION_HOST_SELECT_CHANNEL,
  EXECUTION_HOST_SNAPSHOT_CHANNEL,
  EXECUTION_HOST_STATUS_CHANNEL,
  EXECUTION_HOST_STOP_INSTANCE_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  EXECUTION_HOST_UPDATE_DAEMON_CHANNEL,
  EXECUTION_HOST_WORKSPACES_CHANNEL,
  EXECUTION_HOST_WRITE_CAPACITY_CHANNEL,
  LINEAR_DELIVERY_CHANNEL,
  LINEAR_DELIVERY_STATUS_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  OPEN_RUN_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
  PREVIEW_SANDBOX_RESET_CHANNEL,
  PREVIEW_SYNC_CHANNEL,
  SUPPORT_EXPORT_CHANNEL,
  SUPPORT_REPORT_DRAFT_CHANNEL,
  UPDATE_CHECK_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_SNAPSHOT_CHANNEL,
  UPDATE_STATUS_CHANNEL,
} from "#shared/ipc-channels";

import { subscribe } from "./subscribe.js";

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
  onOpenRun: (listener: (runId: string) => void): (() => void) =>
    subscribe(OPEN_RUN_CHANNEL, listener),
  executionHost: {
    snapshot: (): Promise<ExecutionHostSnapshot> =>
      ipcRenderer.invoke(EXECUTION_HOST_SNAPSHOT_CHANNEL),
    select: (id: ExecutionHostId): Promise<ExecutionHostSelectResult> =>
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
    readCapacity: (hostId: ExecutionHostId): Promise<ExecutionHostCapacityResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_READ_CAPACITY_CHANNEL, hostId),
    writeCapacity: (
      hostId: ExecutionHostId,
      maxConcurrentSessions: number,
    ): Promise<ExecutionHostCapacityResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_WRITE_CAPACITY_CHANNEL, hostId, maxConcurrentSessions),
    listSshAliases: (): Promise<string[]> => ipcRenderer.invoke(EXECUTION_HOST_ALIASES_CHANNEL),
    listRemoteRepositories: (): Promise<RemoteRepositoryListResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_REPOSITORIES_CHANNEL),
    listProjects: (): Promise<ExecutionHostProjectsEntry[]> =>
      ipcRenderer.invoke(EXECUTION_HOST_PROJECTS_CHANNEL),
    listRepositories: (): Promise<ExecutionHostRepositoriesEntry[]> =>
      ipcRenderer.invoke(EXECUTION_HOST_CATALOG_REPOSITORIES_CHANNEL),
    deleteRepository: (
      hostId: ExecutionHostId,
      repositoryId: string,
    ): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_DELETE_REPOSITORY_CHANNEL, hostId, repositoryId),
    readWorkspaces: (
      hostId: ExecutionHostId,
    ): Promise<ExecutionHostCallResult<WorkspaceInventory>> =>
      ipcRenderer.invoke(EXECUTION_HOST_WORKSPACES_CHANNEL, hostId),
    readInbox: (hostId: ExecutionHostId): Promise<ExecutionHostCallResult<InboxSnapshot>> =>
      ipcRenderer.invoke(EXECUTION_HOST_INBOX_CHANNEL, hostId),
    readProjectHealth: (
      hostId: ExecutionHostId,
      projectId: string,
    ): Promise<ExecutionHostCallResult<ProjectHealthReport>> =>
      ipcRenderer.invoke(EXECUTION_HOST_PROJECT_HEALTH_CHANNEL, hostId, projectId),
    reconcileWorkspaces: (
      hostId: ExecutionHostId,
    ): Promise<ExecutionHostCallResult<WorkspaceReconcileReport>> =>
      ipcRenderer.invoke(EXECUTION_HOST_RECONCILE_WORKSPACES_CHANNEL, hostId),
    cleanupWorkspace: (
      hostId: ExecutionHostId,
      workspaceId: string,
      force: boolean,
    ): Promise<ExecutionHostCallResult<WorkspaceCleanupResult>> =>
      ipcRenderer.invoke(EXECUTION_HOST_CLEANUP_WORKSPACE_CHANNEL, hostId, workspaceId, force),
    openWorkspace: (
      hostId: ExecutionHostId,
      path: string,
      target: WorkspaceOpenTarget,
    ): Promise<ExecutionHostOperationResult> =>
      ipcRenderer.invoke(EXECUTION_HOST_OPEN_WORKSPACE_CHANNEL, hostId, path, target),
    onRemoteStatus: (listener: (status: RemoteHostStatus) => void): (() => void) =>
      subscribe(EXECUTION_HOST_STATUS_CHANNEL, listener),
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
    saveKey: (request: ConnectLinearRequest): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_SAVE_KEY_CHANNEL, request),
    forgetKey: (connectionId: string): Promise<LinearVaultOperationResult> =>
      ipcRenderer.invoke(LINEAR_FORGET_KEY_CHANNEL, connectionId),
    delivery: (): Promise<LinearDeliverySnapshot> => ipcRenderer.invoke(LINEAR_DELIVERY_CHANNEL),
    onDelivery: (listener: (snapshot: LinearDeliverySnapshot) => void): (() => void) =>
      subscribe(LINEAR_DELIVERY_STATUS_CHANNEL, listener),
  },
  support: {
    exportBundle: (diagnostic: ErrorDiagnostic): Promise<SupportBundleExportResult> =>
      ipcRenderer.invoke(SUPPORT_EXPORT_CHANNEL, diagnostic),
    openReportDraft: (draft: ProblemReportDraft): Promise<void> =>
      ipcRenderer.invoke(SUPPORT_REPORT_DRAFT_CHANNEL, draft),
  },
  update: {
    snapshot: (): Promise<DesktopUpdateSnapshot | null> =>
      ipcRenderer.invoke(UPDATE_SNAPSHOT_CHANNEL),
    check: (): Promise<void> => ipcRenderer.invoke(UPDATE_CHECK_CHANNEL),
    install: (): Promise<void> => ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL),
    onChange: (listener: (snapshot: DesktopUpdateSnapshot) => void): (() => void) =>
      subscribe(UPDATE_STATUS_CHANNEL, listener),
  },
  preview,
  sandbox: {
    reset: (): Promise<PreviewSandboxResetResult> =>
      ipcRenderer.invoke(PREVIEW_SANDBOX_RESET_CHANNEL),
  },
} satisfies OtomatDesktopBridge);
