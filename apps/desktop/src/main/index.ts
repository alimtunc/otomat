import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { APP_ORIGIN, DEV_SERVER_ENV } from "#shared/constants";
import { SPLASH_RETRY_CHANNEL, SPLASH_STATUS_CHANNEL, type StartupStatus } from "#shared/startup";
import { resolveUserPath } from "#shared/user-path";

import { buildCsp } from "./csp.js";
import { DaemonController } from "./daemon.js";
import { registerIpc, type IpcState } from "./ipc.js";
import { LinearCoordinator } from "./linear-coordinator.js";
import { createMainLinearVault } from "./linear.js";
import { resolveAppPaths, type AppPaths } from "./paths.js";
import { registerAppSchemePrivileged, serveAppScheme } from "./protocol.js";
import { hardenWebContents } from "./security.js";
import { createCockpitWindow, createSplashWindow } from "./windows.js";

function describeStartupError(error: unknown): string {
  return error instanceof Error ? error.message : "The local daemon could not be started.";
}

/** Owns the desktop app lifecycle: boot the daemon behind a splash, then reveal the cockpit. */
class DesktopApp {
  private readonly paths: AppPaths;
  private readonly daemon: DaemonController;
  private readonly linear: LinearCoordinator;
  private readonly ipcState: IpcState = { daemonUrl: "" };
  private readonly devServer: string | null;
  private splash: BrowserWindow | null = null;
  private cockpit: BrowserWindow | null = null;
  private isQuitting = false;

  constructor() {
    this.devServer = process.env[DEV_SERVER_ENV] ?? null;
    this.paths = resolveAppPaths();
    const userPath = resolveUserPath({ platform: process.platform, env: process.env });
    process.env.PATH = userPath; // main-process git/shell calls resolve user CLIs too
    const dataDir = app.getPath("userData");
    this.linear = new LinearCoordinator(
      createMainLinearVault(dataDir),
      () => this.ipcState.daemonUrl,
    );
    this.daemon = new DaemonController({
      daemonEntry: this.paths.daemonEntry,
      dbPath: join(dataDir, "otomat.db"),
      projectRoot: dataDir,
      userPath,
      packaged: this.paths.packaged,
      electronBinary: process.execPath,
    });
  }

  onReady(): void {
    registerIpc(this.ipcState, this.linear);
    ipcMain.on(SPLASH_RETRY_CHANNEL, () => void this.runStartup());
    app.on("web-contents-created", (_event, contents) =>
      hardenWebContents(contents, this.allowedOrigins()),
    );
    if (this.paths.packaged && this.paths.webDist !== null) {
      serveAppScheme(this.paths.webDist, () => buildCsp(this.ipcState.daemonUrl));
    }
    this.splash = createSplashWindow(this.paths);
    void this.runStartup();
  }

  focusPrimary(): void {
    const window = this.cockpit ?? this.splash;
    if (window === null) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  }

  /** Returns true when quit must wait for the daemon to stop; false when there is nothing to defer. */
  beginQuitIfNeeded(done: () => void): boolean {
    if (this.isQuitting || !this.daemon.running) return false;
    this.isQuitting = true;
    this.daemon
      .stop()
      .catch((error) => console.error("[otomat-desktop] daemon stop failed", error))
      .finally(done);
    return true;
  }

  private async runStartup(): Promise<void> {
    this.sendStatus({ phase: "launching" });
    try {
      this.ipcState.daemonUrl = await this.daemon.start();
      await this.linear.restore();
      this.openCockpit();
      this.closeSplash();
    } catch (error) {
      this.sendStatus({ phase: "failed", message: describeStartupError(error) });
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

  private closeSplash(): void {
    this.splash?.close();
    this.splash = null;
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

registerAppSchemePrivileged();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let desktop: DesktopApp | null = null;

  app.on("second-instance", () => desktop?.focusPrimary());
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (desktop !== null && desktop.beginQuitIfNeeded(() => app.quit())) event.preventDefault();
  });

  app
    .whenReady()
    .then(() => {
      desktop = new DesktopApp();
      desktop.onReady();
    })
    .catch((error) => {
      console.error("[otomat-desktop] failed to start", error);
      app.quit();
    });
}
