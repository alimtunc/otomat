import { afterEach, expect, it, vi } from "vitest";

import { DesktopApp } from "#main/app";
import type { AppPaths } from "#main/paths";
import { DEV_SERVER_ENV } from "#shared/constants";
import { scratchDir } from "#support/scratch-dir";

const harness = vi.hoisted(() => ({
  cockpitUrls: [] as (string | null)[],
  hardenedOrigins: [] as string[][],
  appListeners: new Map<string, (...args: unknown[]) => void>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "/unused",
    on: (event: string, listener: (...args: unknown[]) => void) =>
      harness.appListeners.set(event, listener),
  },
  BrowserWindow: vi.fn(),
  dialog: { showMessageBox: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));
vi.mock("#main/runtime", () => ({
  createDesktopRuntime: () => ({
    dataDirectory: { root: "/unused", dbPath: "/unused/otomat.db", backupsDir: "/unused/backups" },
    desktopLog: { write: vi.fn(), read: () => "" },
    daemonLog: { write: vi.fn(), read: () => "" },
    daemon: { running: false, start: async () => "http://127.0.0.1:49152", stop: vi.fn() },
    linear: { reconcile: async () => {} },
    hosts: { bootActivate: async () => null, shutdown: async () => {}, hasActiveSession: false },
    sandbox: { ensure: async () => {} },
  }),
}));
vi.mock("#main/support", () => ({
  DesktopSupport: class {
    exportBundle(): Promise<void> {
      return Promise.resolve();
    }
    showDataPolicy(): void {}
  },
}));
vi.mock("#main/ipc", () => ({ registerIpc: vi.fn() }));
vi.mock("#main/menu", () => ({ installApplicationMenu: vi.fn() }));
vi.mock("#main/protocol", () => ({ serveAppScheme: vi.fn() }));
vi.mock("#main/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#main/security")>()),
  hardenWebContents: (_contents: unknown, origins: string[]) =>
    harness.hardenedOrigins.push(origins),
}));
vi.mock("#main/windows", () => ({
  createCockpitWindow: (_paths: unknown, startUrl: string | null) => {
    harness.cockpitUrls.push(startUrl);
    return { focus: vi.fn(), isMinimized: () => false, on: vi.fn() };
  },
  createSplashWindow: async () => ({
    close: vi.fn(),
    focus: vi.fn(),
    isDestroyed: () => false,
    isMinimized: () => false,
    webContents: { send: vi.fn() },
  }),
}));
vi.mock("#shared/user-path", () => ({ resolveUserPath: () => "/usr/bin" }));

function devPaths(devDataRoot: string | null): AppPaths {
  return {
    packaged: false,
    daemonEntry: "/unused/daemon/index.js",
    webDist: null,
    splashHtml: "/unused/splash.html",
    sandboxTemplateDir: "/tmp/otomat-sandbox-template",
    cockpitPreload: "/unused/cockpit.cjs",
    splashPreload: "/unused/splash.cjs",
    devDataRoot,
  };
}

async function startDesktop(url: string | null): Promise<void> {
  if (url !== null) vi.stubEnv(DEV_SERVER_ENV, url);
  const scratch = scratchDir("otomat-handoff-");
  await new DesktopApp(devPaths(scratch)).onReady();
}

afterEach(() => {
  harness.cockpitUrls.length = 0;
  harness.hardenedOrigins.length = 0;
  harness.appListeners.clear();
  vi.unstubAllEnvs();
});

it("loads the exact dev server URL the runner handed over, not a default port", async () => {
  const url = "http://127.0.0.1:51987";

  await startDesktop(url);

  expect(harness.cockpitUrls).toEqual([url]);
});

it("allowlists only the origin of the session's own dev server", async () => {
  await startDesktop("http://127.0.0.1:51987");

  const created = harness.appListeners.get("web-contents-created");
  if (created === undefined) throw new Error("The shell registered no web-contents hardening.");
  created(null, {});

  expect(harness.hardenedOrigins).toEqual([["http://127.0.0.1:51987"]]);
});

it("falls back to the app scheme when no dev server is handed over", async () => {
  vi.stubEnv(DEV_SERVER_ENV, "");

  await startDesktop(null);

  expect(harness.cockpitUrls).toEqual([null]);
  expect(harness.appListeners.get("web-contents-created")).toBeDefined();
});
