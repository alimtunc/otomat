import { basename } from "node:path";

import type { DesktopStartupDiagnostic, LinearVaultOperationResult } from "@otomat/domain";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { APP_ORIGIN, DEV_SERVER_ENV } from "#shared/constants";
import { SPLASH_RETRY_CHANNEL, SPLASH_STATUS_CHANNEL, type StartupStatus } from "#shared/startup";
import { resolveUserPath } from "#shared/user-path";

import { buildCsp } from "./csp.js";
import { findLatestManagedBackup } from "./data-safety/index.js";
import { redactLogText } from "./data-safety/redaction.js";
import { createDesktopRuntime, type DesktopRuntime } from "./desktop-runtime.js";
import { DesktopSupport } from "./desktop-support.js";
import { registerIpc, type IpcState } from "./ipc.js";
import { installApplicationMenu } from "./menu.js";
import { resolveAppPaths, type AppPaths } from "./paths.js";
import { serveAppScheme } from "./protocol.js";
import { hardenWebContents } from "./security.js";
import { describeStartupFailure, isRecoverableStartupDiagnostic } from "./startup-failure.js";
import { createCockpitWindow, createSplashWindow } from "./windows.js";

function unavailableLinear(): LinearVaultOperationResult {
  return { ok: false, message: "The local daemon is not available.", error_code: null };
}

export class DesktopApp {
  private readonly paths: AppPaths;
  private readonly ipcState: IpcState = { daemonUrl: "" };
  private readonly devServer: string | null;
  private readonly userPath: string;
  private readonly userData: string;
  private readonly support: DesktopSupport;
  private runtime: DesktopRuntime | null = null;
  private diagnostic: DesktopStartupDiagnostic | null = null;
  private splash: BrowserWindow | null = null;
  private cockpit: BrowserWindow | null = null;
  private isQuitting = false;
  private operation: "restoring" | "starting" | null = null;
  private reportedLogFailure = false;
  private readonly rejectedBackupPaths = new Set<string>();
  private startupLog = "";

  constructor() {
    this.devServer = process.env[DEV_SERVER_ENV] ?? null;
    this.paths = resolveAppPaths();
    this.userPath = resolveUserPath({ platform: process.platform, env: process.env });
    process.env.PATH = this.userPath;
    this.userData = app.getPath("userData");
    this.support = new DesktopSupport({
      daemonUrl: () => this.ipcState.daemonUrl,
      desktopLog: () => this.runtime?.desktopLog ?? null,
      daemonLog: () => this.runtime?.daemonLog ?? null,
      startupLog: () => this.startupLog,
      log: (message) => this.logDesktop(message),
    });
  }

  async onReady(): Promise<void> {
    registerIpc(this.ipcState, {
      saveLinearKey: (apiKey) =>
        this.runtime?.linear.save(apiKey) ?? Promise.resolve(unavailableLinear()),
      forgetLinearKey: () => this.runtime?.linear.forget() ?? Promise.resolve(unavailableLinear()),
      restoreBackup: () => this.restoreBackup(),
      exportSupportBundle: () => this.support.exportBundle(),
      showDataPolicy: () => this.support.showDataPolicy(),
    });
    ipcMain.on(SPLASH_RETRY_CHANNEL, () => void this.runStartup());
    app.on("web-contents-created", (_event, contents) =>
      hardenWebContents(contents, this.allowedOrigins()),
    );
    if (this.paths.packaged && this.paths.webDist !== null) {
      serveAppScheme(this.paths.webDist, () => buildCsp(this.ipcState.daemonUrl));
    }
    this.splash = await createSplashWindow(this.paths);
    installApplicationMenu({
      exportSupportBundle: () => this.support.exportBundle(),
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
    if (this.runtime?.daemon.running !== true) return false;
    this.isQuitting = true;
    this.runtime.daemon
      .stop()
      .then(() => {
        this.isQuitting = false;
        done();
      })
      .catch(() => {
        this.isQuitting = false;
        this.logDesktop("Daemon stop failed; desktop shutdown remains blocked for retry.");
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
        daemonUrl: () => this.ipcState.daemonUrl,
      });
      this.ipcState.daemonUrl = await this.runtime.daemon.start();
      await this.runtime.linear.restore();
      this.rejectedBackupPaths.clear();
      this.diagnostic = null;
      this.openCockpit();
      this.splash?.close();
      this.splash = null;
    } catch (error) {
      this.ipcState.daemonUrl = "";
      this.diagnostic = this.withAvailableBackup(describeStartupFailure(error));
      this.logDesktop(`${this.diagnostic.code}: ${this.diagnostic.message}`);
      this.sendStatus({ phase: "failed", diagnostic: this.diagnostic });
    } finally {
      if (this.operation === "starting") this.operation = null;
    }
  }

  private async restoreBackup(): Promise<void> {
    const diagnostic = this.diagnostic;
    const backupPath = diagnostic?.backup_path;
    if (
      diagnostic === null ||
      backupPath === null ||
      backupPath === undefined ||
      this.runtime === null ||
      this.operation !== null
    ) {
      return;
    }
    this.operation = "restoring";
    try {
      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: "Restore Otomat data?",
        message: "Restore the last known backup?",
        detail:
          "The current database and its WAL files will be preserved in the backups directory before restoration. Otomat will then restart its local daemon.",
        buttons: ["Cancel", "Restore Backup"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (confirmation.response !== 1) {
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
        this.logDesktop(`${restoreDiagnostic.code}: ${restoreDiagnostic.message}`);
        this.diagnostic = this.withAvailableBackup({ ...diagnostic, backup_path: null });
      } else {
        this.diagnostic = this.withAvailableBackup(restoreDiagnostic);
      }
      this.logDesktop(`${this.diagnostic.code}: ${this.diagnostic.message}`);
      this.sendStatus({ phase: "failed", diagnostic: this.diagnostic });
    } finally {
      if (this.operation === "restoring") this.operation = null;
    }
  }

  private logDesktop(message: string): void {
    if (this.runtime !== null) {
      try {
        this.runtime.desktopLog.write(message);
        return;
      } catch {
        if (!this.reportedLogFailure) {
          this.reportedLogFailure = true;
          console.error("[otomat-desktop] desktop log write failed");
        }
      }
    }
    this.startupLog = `${this.startupLog}${redactLogText(message).trimEnd()}\n`.slice(-65_536);
  }

  private withAvailableBackup(diagnostic: DesktopStartupDiagnostic): DesktopStartupDiagnostic {
    if (
      !isRecoverableStartupDiagnostic(diagnostic) ||
      diagnostic.backup_path !== null ||
      this.runtime === null
    ) {
      return diagnostic;
    }
    try {
      return {
        ...diagnostic,
        backup_path: findLatestManagedBackup(
          this.runtime.dataDirectory.backupsDir,
          basename(this.runtime.dataDirectory.dbPath),
          this.rejectedBackupPaths,
        ),
      };
    } catch {
      this.logDesktop("Managed backup discovery failed.");
      return diagnostic;
    }
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

  private allowedOrigins(): string[] {
    if (this.devServer === null) return [APP_ORIGIN];
    try {
      return [new URL(this.devServer).origin];
    } catch {
      return [];
    }
  }
}
