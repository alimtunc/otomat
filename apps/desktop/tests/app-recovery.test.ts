import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { scratchDir } from "#support/scratch-dir";

const harness = vi.hoisted(() => ({
  actions: null as { restoreBackup(): Promise<void> } | null,
  runtime: null as {
    dataDirectory: { root: string; dbPath: string; backupsDir: string };
    desktopLog: { write(message: string): void };
    daemonLog: { write(message: string): void };
    daemon: {
      running: boolean;
      start(): Promise<string>;
      stop(): Promise<void>;
      restoreBackup(path: string): Promise<void>;
    };
    linear: { restore(): Promise<void> };
    hosts: {
      bootActivate(): Promise<string | null>;
      shutdown(): Promise<void>;
      hasActiveSession: boolean;
    };
  } | null,
  userData: "",
}));

vi.mock("electron", () => ({
  app: { getPath: () => harness.userData, on: vi.fn() },
  BrowserWindow: vi.fn(),
  dialog: { showMessageBox: async () => ({ response: 1 }) },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));
vi.mock("#main/runtime", () => ({
  createDesktopRuntime: () => harness.runtime,
}));
vi.mock("#main/support", () => ({
  DesktopSupport: class {
    exportBundle(): Promise<void> {
      return Promise.resolve();
    }
    showDataPolicy(): void {}
    confirmRestore(): Promise<boolean> {
      return Promise.resolve(true);
    }
  },
}));
vi.mock("#main/ipc", () => ({
  registerIpc: (_state: unknown, actions: { restoreBackup(): Promise<void> }) => {
    harness.actions = actions;
  },
}));
vi.mock("#main/menu", () => ({ installApplicationMenu: vi.fn() }));
vi.mock("#main/protocol", () => ({ serveAppScheme: vi.fn() }));
vi.mock("#main/security", () => ({
  hardenWebContents: vi.fn(),
  resolveAllowedOrigins: vi.fn(() => []),
}));
vi.mock("#main/startup-failure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#main/startup-failure")>()),
  describeStartupFailure: (error: { diagnostic?: unknown }) =>
    error.diagnostic ?? {
      code: "startup_failed",
      message: "Startup failed.",
      backup_path: null,
      available_bytes: null,
      required_bytes: null,
    },
}));
vi.mock("#main/windows", () => ({
  createCockpitWindow: () => ({
    focus: vi.fn(),
    isMinimized: () => false,
    on: vi.fn(),
  }),
  createSplashWindow: async () => ({
    close: vi.fn(),
    focus: vi.fn(),
    isDestroyed: () => false,
    isMinimized: () => false,
    webContents: { send: vi.fn() },
  }),
}));
vi.mock("#shared/user-path", () => ({ resolveUserPath: () => "/usr/bin" }));

import { DesktopApp } from "#main/app";
import type { AppPaths } from "#main/paths";

const DEV_PATHS: AppPaths = {
  packaged: false,
  daemonEntry: "/tmp/daemon.js",
  webDist: null,
  splashHtml: "/tmp/splash.html",
  sandboxTemplateDir: "/tmp/otomat-sandbox-template",
  cockpitPreload: "/tmp/cockpit.cjs",
  splashPreload: "/tmp/splash.cjs",
  devDataRoot: "/tmp/otomat-dev-root",
};

afterEach(() => {
  harness.actions = null;
  harness.runtime = null;
  harness.userData = "";
});

it("offers the next managed backup after the daemon rejects the newest candidate", async () => {
  const scratch = scratchDir("otomat-desktop-backup-fallback-");
  const dbPath = join(scratch, "otomat.db");
  const backupsDir = join(scratch, "backups");
  mkdirSync(backupsDir);
  const older = join(
    backupsDir,
    "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  );
  const newer = join(
    backupsDir,
    "otomat-backup-2026-07-23T11-00-00.000Z-123e4567-e89b-42d3-b456-426614174001.sqlite",
  );
  writeFileSync(older, "valid backup");
  writeFileSync(newer, "corrupt backup");
  const now = new Date();
  utimesSync(older, new Date(now.getTime() - 1000), new Date(now.getTime() - 1000));
  utimesSync(newer, now, now);

  const restoreBackup = vi
    .fn<(path: string) => Promise<void>>()
    .mockRejectedValueOnce({
      diagnostic: {
        code: "invalid_backup",
        message: "Invalid backup.",
        backup_path: null,
        available_bytes: null,
        required_bytes: null,
      },
    })
    .mockResolvedValue(undefined);
  let startupAttempts = 0;
  harness.userData = scratch;
  harness.runtime = {
    dataDirectory: { root: scratch, dbPath, backupsDir },
    desktopLog: { write: vi.fn() },
    daemonLog: { write: vi.fn() },
    daemon: {
      running: false,
      start: async () => {
        startupAttempts += 1;
        if (startupAttempts === 1) {
          throw {
            diagnostic: {
              code: "migration_failed",
              message: "Migration failed.",
              backup_path: null,
              available_bytes: null,
              required_bytes: null,
            },
          };
        }
        return "http://127.0.0.1:4319";
      },
      stop: async () => {},
      restoreBackup,
    },
    linear: { restore: async () => {} },
    hosts: { bootActivate: async () => null, shutdown: async () => {}, hasActiveSession: false },
  };

  const desktop = new DesktopApp(DEV_PATHS);
  await desktop.onReady();
  if (harness.actions === null) throw new Error("Desktop IPC actions were not registered.");

  await harness.actions.restoreBackup();
  await harness.actions.restoreBackup();

  expect(restoreBackup.mock.calls.map(([path]) => path)).toEqual([newer, older]);
});

it("keeps shutdown blocked and allows retry when daemon stop fails", async () => {
  const stop = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("still running"));
  const writeDesktopLog = vi.fn();
  harness.userData = "/tmp/otomat-desktop-quit-test";
  harness.runtime = {
    dataDirectory: {
      root: harness.userData,
      dbPath: join(harness.userData, "otomat.db"),
      backupsDir: join(harness.userData, "backups"),
    },
    desktopLog: { write: writeDesktopLog },
    daemonLog: { write: vi.fn() },
    daemon: {
      running: true,
      start: async () => "http://127.0.0.1:4319",
      stop,
      restoreBackup: async () => {},
    },
    linear: { restore: async () => {} },
    hosts: { bootActivate: async () => null, shutdown: async () => {}, hasActiveSession: false },
  };
  const desktop = new DesktopApp(DEV_PATHS);
  await desktop.onReady();
  const quit = vi.fn();

  expect(desktop.beginQuitIfNeeded(quit)).toBe(true);
  await vi.waitFor(() =>
    expect(writeDesktopLog).toHaveBeenCalledWith(
      "Daemon stop failed; desktop shutdown remains blocked for retry.",
    ),
  );
  expect(quit).not.toHaveBeenCalled();

  stop.mockResolvedValueOnce(undefined);
  expect(desktop.beginQuitIfNeeded(quit)).toBe(true);
  expect(desktop.beginQuitIfNeeded(quit)).toBe(true);
  await vi.waitFor(() => expect(quit).toHaveBeenCalledOnce());
});
