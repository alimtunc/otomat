import { basename } from "node:path";

import type { DesktopStartupDiagnostic } from "@otomat/domain";
import { app, BrowserWindow, ipcMain } from "electron";

import type { BuildInfo } from "#shared/build-info";
import { DEV_SERVER_ENV } from "#shared/constants";
import {
  EXECUTION_HOST_STATUS_CHANNEL,
  LINEAR_DELIVERY_STATUS_CHANNEL,
} from "#shared/ipc-channels";
import { SPLASH_RETRY_CHANNEL, SPLASH_STATUS_CHANNEL, type StartupStatus } from "#shared/startup";
import { resolveUserPath } from "#shared/user-path";

import { buildCsp } from "./csp.js";
import { resolveExpectedBuild } from "./expected-build.js";
import { buildIpcActions } from "./ipc-actions.js";
import { registerIpc, type IpcState } from "./ipc.js";
import { installApplicationMenu } from "./menu.js";
import type { AppPaths } from "./paths.js";
import { serveAppScheme } from "./protocol.js";
import { createDesktopRuntime, type DesktopRuntime } from "./runtime.js";
import { hardenWebContents, resolveAllowedOrigins } from "./security.js";
import {
  attachAvailableBackup,
  describeStartupFailure,
  type BackupDiscoveryContext,
} from "./startup-failure.js";
import { StartupLogSink } from "./startup-log-sink.js";
import { DesktopSupport } from "./support.js";
import { createCockpitWindow, createSplashWindow } from "./windows.js";

export class DesktopApp {
  private readonly ipcState: IpcState;
  private readonly devServer: string | null;
  private readonly userPath: string;
  private readonly userData: string;
  private readonly support: DesktopSupport;
  private runtime: DesktopRuntime | null = null;
  private localDaemonUrl = "";
  private diagnostic: DesktopStartupDiagnostic | null = null;
  private splash: BrowserWindow | null = null;
  private cockpit: BrowserWindow | null = null;
  private isQuitting = false;
  private operation: "restoring" | "starting" | null = null;
  private readonly rejectedBackupPaths = new Set<string>();
  private readonly log = new StartupLogSink(() => this.runtime?.desktopLog ?? null);

  constructor(
    private readonly paths: AppPaths,
    private readonly buildInfo: BuildInfo,
  ) {
    const devServer = process.env[DEV_SERVER_ENV]?.trim() ?? "";
    this.devServer = devServer === "" ? null : devServer;
    this.userPath = resolveUserPath({ platform: process.platform, env: process.env });
    process.env.PATH = this.userPath;
    this.userData = app.getPath("userData");
    // The sandbox is a preview's test bed; no other channel ever seeds fixtures.
    this.ipcState = {
      daemonUrl: "",
      preview: buildInfo.channel === "preview",
      build: {
        version: buildInfo.version,
        commit: buildInfo.commit_short,
        channel: buildInfo.channel,
      },
    };
    this.support = new DesktopSupport({
      daemonUrl: () => this.ipcState.daemonUrl,
      logs: () => ({
        desktop: `${this.log.read()}${this.runtime?.desktopLog.read() ?? ""}`,
        daemon: this.runtime?.daemonLog.read() ?? "",
      }),
      log: (message) => this.log.write(message),
    });
  }

  async onReady(): Promise<void> {
    const actions = buildIpcActions({
      runtime: () => this.runtime,
      support: this.support,
      restoreBackup: () => this.restoreBackup(),
      reloadCockpit: () => this.cockpit?.webContents.reload(),
    });
    registerIpc(this.ipcState, actions);
    ipcMain.on(SPLASH_RETRY_CHANNEL, () => void this.runStartup());
    const origins = resolveAllowedOrigins(this.devServer, (message) => this.log.write(message));
    app.on("web-contents-created", (_event, contents) => hardenWebContents(contents, origins));
    if (this.paths.packaged && this.paths.webDist !== null) {
      serveAppScheme(this.paths.webDist, () => buildCsp(this.ipcState.daemonUrl));
    }
    this.splash = await createSplashWindow(this.paths);
    installApplicationMenu({
      exportSupportBundle: () => this.support.exportBundleWithFeedback(),
      showDataPolicy: () => this.support.showDataPolicy(),
    });
    await this.runStartup();
  }

  focusPrimary(): void {
    const window = this.cockpit ?? this.splash;
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  }

  beginQuitIfNeeded(done: () => void): boolean {
    if (this.isQuitting) return true;
    const runtime = this.runtime;
    if (runtime === null) return false;
    if (runtime.daemon.running !== true && runtime.hosts.remoteSession === null) return false;
    this.isQuitting = true;
    runtime.hosts
      .shutdown()
      .catch((error: unknown) => this.log.write(`Tunnel stop failed during quit: ${String(error)}`))
      .then(() => (runtime.daemon.running === true ? runtime.daemon.stop() : undefined))
      .then(() => {
        this.isQuitting = false;
        done();
      })
      .catch(() => {
        this.isQuitting = false;
        this.log.write("Daemon stop failed; desktop shutdown remains blocked for retry.");
      });
    return true;
  }

  private async runStartup(): Promise<void> {
    if (this.operation !== null) return;
    this.operation = "starting";
    this.sendStatus({ phase: "launching" });
    try {
      this.runtime ??= createDesktopRuntime({
        paths: this.paths,
        userData: this.userData,
        userPath: this.userPath,
        expectedBuild: resolveExpectedBuild(this.buildInfo, (message) => this.log.write(message)),
        channel: this.buildInfo.channel,
        localDaemonUrl: () => this.localDaemonUrl,
        onRemoteStatus: (status) => {
          this.sendToCockpit(EXECUTION_HOST_STATUS_CHANNEL, status);
          // A host that just answered may lack the Linear key, or still hold a revoked one.
          if (status.phase === "connected") void this.runtime?.linear.reconcile();
        },
        onLinearDelivery: (delivery) =>
          this.sendToCockpit(LINEAR_DELIVERY_STATUS_CHANNEL, delivery),
        applyRendererUrl: (url) => this.applyRendererUrl(url),
        onSandboxDaemonStarted: (url) => {
          this.localDaemonUrl = url;
          void this.runtime?.linear.reconcile();
          // An active remote session keeps the tunnel URL; only the local view re-points.
          if (this.runtime?.hosts.activeHostId !== "remote") this.ipcState.daemonUrl = url;
        },
      });
      this.localDaemonUrl = await this.runtime.daemon.start();
      this.ipcState.daemonUrl = this.localDaemonUrl;
      await this.runtime.sandbox.ensure(this.localDaemonUrl);
      const remoteUrl = await this.runtime.hosts.bootActivate();
      if (remoteUrl !== null) this.ipcState.daemonUrl = remoteUrl;
      // Resolving Linear targets warms the remote session, so it must not precede bootActivate's port reservation.
      await this.runtime.linear.reconcile();
      this.rejectedBackupPaths.clear();
      this.diagnostic = null;
      this.openCockpit();
      this.splash?.close();
      this.splash = null;
    } catch (error) {
      this.ipcState.daemonUrl = "";
      this.localDaemonUrl = "";
      this.diagnostic = attachAvailableBackup(describeStartupFailure(error), this.backupContext());
      this.log.write(`${this.diagnostic.code}: ${this.diagnostic.message}`);
      this.sendStatus({ phase: "failed", diagnostic: this.diagnostic });
    } finally {
      if (this.operation === "starting") this.operation = null;
    }
  }

  private async restoreBackup(): Promise<void> {
    const diagnostic = this.diagnostic;
    const backupPath = diagnostic?.backup_path;
    if (diagnostic === null || this.runtime === null || this.operation !== null) return;
    if (backupPath === null || backupPath === undefined) return;
    this.operation = "restoring";
    try {
      if (!(await this.support.confirmRestore())) {
        this.sendStatus({ phase: "failed", diagnostic });
        return;
      }
      this.sendStatus({ phase: "restoring" });
      await this.runtime.daemon.restoreBackup(backupPath);
      this.ipcState.daemonUrl = "";
      this.diagnostic = null;
      this.operation = null;
      await this.runStartup();
    } catch (error) {
      const restoreDiagnostic = describeStartupFailure(error);
      if (restoreDiagnostic.code === "invalid_backup") {
        this.rejectedBackupPaths.add(backupPath);
        this.log.write(`${restoreDiagnostic.code}: ${restoreDiagnostic.message}`);
        this.diagnostic = attachAvailableBackup(
          { ...diagnostic, backup_path: null },
          this.backupContext(),
        );
      } else {
        this.diagnostic = attachAvailableBackup(restoreDiagnostic, this.backupContext());
      }
      this.log.write(`${this.diagnostic.code}: ${this.diagnostic.message}`);
      this.sendStatus({ phase: "failed", diagnostic: this.diagnostic });
    } finally {
      if (this.operation === "restoring") this.operation = null;
    }
  }

  private backupContext(): BackupDiscoveryContext | null {
    if (this.runtime === null) return null;
    return {
      backupsDir: this.runtime.dataDirectory.backupsDir,
      dbFileName: basename(this.runtime.dataDirectory.dbPath),
      rejectedBackupPaths: this.rejectedBackupPaths,
      log: (message) => this.log.write(message),
    };
  }

  /** Host switches re-point the renderer and reload it so the preload re-reads the daemon URL. */
  private applyRendererUrl(url: string): void {
    this.ipcState.daemonUrl = url;
    this.cockpit?.webContents.reload();
  }

  private sendToCockpit(channel: string, payload: unknown): void {
    const contents = this.cockpit?.webContents;
    if (contents === undefined || contents.isDestroyed()) return;
    contents.send(channel, payload);
  }

  private openCockpit(): void {
    if (this.cockpit !== null) {
      this.cockpit.focus();
      return;
    }
    const window = createCockpitWindow(this.paths, this.devServer);
    window.on("closed", () => (this.cockpit = null));
    this.cockpit = window;
  }

  private sendStatus(status: StartupStatus): void {
    if (this.splash === null || this.splash.isDestroyed()) return;
    this.splash.webContents.send(SPLASH_STATUS_CHANNEL, status);
  }
}
