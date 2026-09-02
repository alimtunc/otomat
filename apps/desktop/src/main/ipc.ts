import type {
  DesktopBuildSummary,
  DesktopUpdateSnapshot,
  LinearDeliverySnapshot,
  LinearVaultOperationResult,
  PreviewSandboxResetResult,
  SupportBundleExportResult,
} from "@otomat/domain";
import { BrowserWindow, dialog, ipcMain } from "electron";

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
  EXECUTION_HOST_PROJECTS_CHANNEL,
  EXECUTION_HOST_READ_CAPACITY_CHANNEL,
  EXECUTION_HOST_RECONCILE_WORKSPACES_CHANNEL,
  EXECUTION_HOST_REGISTER_PROJECT_CHANNEL,
  EXECUTION_HOST_REMOVE_CHANNEL,
  EXECUTION_HOST_REPOSITORIES_CHANNEL,
  EXECUTION_HOST_SELECT_CHANNEL,
  EXECUTION_HOST_SNAPSHOT_CHANNEL,
  EXECUTION_HOST_STOP_INSTANCE_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  EXECUTION_HOST_UPDATE_DAEMON_CHANNEL,
  EXECUTION_HOST_WORKSPACES_CHANNEL,
  EXECUTION_HOST_WRITE_CAPACITY_CHANNEL,
  LINEAR_DELIVERY_CHANNEL,
  LINEAR_FORGET_KEY_CHANNEL,
  LINEAR_SAVE_KEY_CHANNEL,
  PICK_DIRECTORY_CHANNEL,
  PREVIEW_SANDBOX_RESET_CHANNEL,
  PREVIEW_SYNC_CHANNEL,
  SUPPORT_EXPORT_CHANNEL,
  SUPPORT_REPORT_DRAFT_CHANNEL,
  UPDATE_CHECK_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_SNAPSHOT_CHANNEL,
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
  /** Identity of this build, so a copied diagnostic names the artifact it came from. */
  build: DesktopBuildSummary;
}

export interface IpcActions {
  saveLinearKey(request: unknown): Promise<LinearVaultOperationResult>;
  forgetLinearKey(connectionId: unknown): Promise<LinearVaultOperationResult>;
  linearDelivery(): LinearDeliverySnapshot;
  restoreBackup(): Promise<void>;
  exportSupportBundle(): Promise<void>;
  exportSupportBundleFor(diagnostic: unknown): Promise<SupportBundleExportResult>;
  openReportDraft(draft: unknown): Promise<void>;
  showDataPolicy(): Promise<void>;
  resetSandbox(): Promise<PreviewSandboxResetResult>;
  update: {
    snapshot(): DesktopUpdateSnapshot | null;
    check(): Promise<void>;
    install(): Promise<void>;
  };
  executionHost: ExecutionHostIpcActions;
}

export function registerIpc(state: IpcState, actions: IpcActions): void {
  ipcMain.on(DAEMON_URL_CHANNEL, (event) => {
    event.returnValue = state.daemonUrl;
  });

  ipcMain.on(PREVIEW_SYNC_CHANNEL, (event) => {
    event.returnValue = state.preview;
  });

  ipcMain.on(BUILD_SYNC_CHANNEL, (event) => {
    event.returnValue = state.build;
  });

  ipcMain.handle(SUPPORT_EXPORT_CHANNEL, (_event, diagnostic: unknown) =>
    actions.exportSupportBundleFor(diagnostic),
  );
  ipcMain.handle(SUPPORT_REPORT_DRAFT_CHANNEL, (_event, draft: unknown) =>
    actions.openReportDraft(draft),
  );

  ipcMain.on(EXECUTION_HOST_SYNC_CHANNEL, (event) => {
    event.returnValue = actions.executionHost.sync();
  });

  ipcMain.handle(PREVIEW_SANDBOX_RESET_CHANNEL, () => actions.resetSandbox());

  ipcMain.handle(UPDATE_SNAPSHOT_CHANNEL, () => actions.update.snapshot());
  ipcMain.handle(UPDATE_CHECK_CHANNEL, () => actions.update.check());
  ipcMain.handle(UPDATE_INSTALL_CHANNEL, () => actions.update.install());

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
  ipcMain.handle(EXECUTION_HOST_READ_CAPACITY_CHANNEL, (_event, hostId: unknown) =>
    actions.executionHost.readCapacity(hostId),
  );
  ipcMain.handle(
    EXECUTION_HOST_WRITE_CAPACITY_CHANNEL,
    (_event, hostId: unknown, maxConcurrentSessions: unknown) =>
      actions.executionHost.writeCapacity(hostId, maxConcurrentSessions),
  );
  ipcMain.handle(EXECUTION_HOST_ALIASES_CHANNEL, () => actions.executionHost.listAliases());
  ipcMain.handle(EXECUTION_HOST_REPOSITORIES_CHANNEL, () =>
    actions.executionHost.listRemoteRepositories(),
  );
  ipcMain.handle(EXECUTION_HOST_PROJECTS_CHANNEL, () => actions.executionHost.listProjects());
  ipcMain.handle(EXECUTION_HOST_CATALOG_REPOSITORIES_CHANNEL, () =>
    actions.executionHost.listRepositories(),
  );
  ipcMain.handle(
    EXECUTION_HOST_DELETE_REPOSITORY_CHANNEL,
    (_event, hostId: unknown, repositoryId: unknown) =>
      actions.executionHost.deleteRepository(hostId, repositoryId),
  );
  ipcMain.handle(EXECUTION_HOST_WORKSPACES_CHANNEL, (_event, hostId: unknown) =>
    actions.executionHost.readWorkspaces(hostId),
  );
  ipcMain.handle(EXECUTION_HOST_INBOX_CHANNEL, (_event, hostId: unknown) =>
    actions.executionHost.readInbox(hostId),
  );
  ipcMain.handle(EXECUTION_HOST_RECONCILE_WORKSPACES_CHANNEL, (_event, hostId: unknown) =>
    actions.executionHost.reconcileWorkspaces(hostId),
  );
  ipcMain.handle(
    EXECUTION_HOST_CLEANUP_WORKSPACE_CHANNEL,
    (_event, hostId: unknown, worktreeId: unknown) =>
      actions.executionHost.cleanupWorkspace(hostId, worktreeId),
  );
  ipcMain.handle(EXECUTION_HOST_INSTANCES_CHANNEL, () => actions.executionHost.listInstances());
  ipcMain.handle(EXECUTION_HOST_STOP_INSTANCE_CHANNEL, (_event, build: unknown) =>
    actions.executionHost.stopInstance(build),
  );
  ipcMain.handle(EXECUTION_HOST_DELETE_INSTANCE_CHANNEL, (_event, build: unknown) =>
    actions.executionHost.deleteInstance(build),
  );
  ipcMain.handle(EXECUTION_HOST_UPDATE_DAEMON_CHANNEL, () =>
    actions.executionHost.updateRemoteDaemon(),
  );

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

  ipcMain.handle(LINEAR_SAVE_KEY_CHANNEL, (_event, request: unknown) =>
    actions.saveLinearKey(request),
  );

  ipcMain.handle(LINEAR_FORGET_KEY_CHANNEL, (_event, connectionId: unknown) =>
    actions.forgetLinearKey(connectionId),
  );
  ipcMain.handle(LINEAR_DELIVERY_CHANNEL, () => actions.linearDelivery());
  ipcMain.handle(SPLASH_RESTORE_CHANNEL, () => actions.restoreBackup());
  ipcMain.handle(SPLASH_EXPORT_SUPPORT_CHANNEL, () => actions.exportSupportBundle());
  ipcMain.handle(SPLASH_SHOW_POLICY_CHANNEL, () => actions.showDataPolicy());
}
