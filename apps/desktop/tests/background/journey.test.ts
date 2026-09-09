import { beforeEach, expect, it, vi } from "vitest";

import { devAppPaths } from "#support/app-paths";

interface FakeCockpit {
  close: ((event: { preventDefault(): void }) => void) | null;
  created: number;
  hidden: boolean;
  shown: number;
  sent: { channel: string; payload: unknown }[];
}

interface TrayEntry {
  label?: string;
  click?: () => void;
}

interface Journey {
  answers: number[];
  dialogs: number;
  requestQuit: () => void;
  exits: number;
  daemonStops: number;
  hostShutdowns: number;
  trayTitles: string[];
  trayMenu: TrayEntry[];
  traysDestroyed: number;
  cockpit: FakeCockpit;
}

const harness = vi.hoisted((): Journey => ({
  answers: [],
  dialogs: 0,
  requestQuit: () => {},
  exits: 0,
  daemonStops: 0,
  hostShutdowns: 0,
  trayTitles: [],
  trayMenu: [],
  traysDestroyed: 0,
  cockpit: { close: null, created: 0, hidden: false, shown: 0, sent: [] },
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "/tmp/otomat-journey",
    getAppPath: () => "/unused/Otomat.app/Contents/Resources/app.asar",
    isPackaged: false,
    on: vi.fn(),
    quit: () => harness.requestQuit(),
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showMessageBox: () => {
      harness.dialogs += 1;
      return Promise.resolve({ response: harness.answers.shift() ?? 2 });
    },
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  Menu: { buildFromTemplate: (template: TrayEntry[]) => template },
  Tray: class {
    setTitle(title: string): void {
      harness.trayTitles.push(title);
    }
    setContextMenu(template: TrayEntry[]): void {
      harness.trayMenu = template;
    }
    setToolTip(): void {}
    destroy(): void {
      harness.traysDestroyed += 1;
    }
  },
  nativeImage: { createFromPath: () => ({ setTemplateImage: vi.fn() }) },
}));
vi.mock("#main/background/read-work", () => ({
  readLocalWork: () =>
    Promise.resolve({
      ok: true,
      items: [
        {
          run_id: "run-42",
          project: "Otomat",
          issue: "OTO-169",
          state: "running",
          started_at: "2026-09-03T10:00:00.000Z",
        },
      ],
    }),
}));
vi.mock("#main/runtime", () => ({
  createDesktopRuntime: () => ({
    dataDirectory: { root: "/tmp", dbPath: "/tmp/otomat.db", backupsDir: "/tmp/backups" },
    desktopLog: { write: vi.fn(), read: () => "" },
    daemonLog: { write: vi.fn(), read: () => "" },
    daemon: {
      running: true,
      start: () => Promise.resolve("http://127.0.0.1:4310"),
      stop: () => {
        harness.daemonStops += 1;
        return Promise.resolve();
      },
    },
    sandbox: { ensure: () => Promise.resolve() },
    linear: { reconcile: () => Promise.resolve() },
    hosts: {
      bootActivate: () => Promise.resolve(null),
      shutdown: () => {
        harness.hostShutdowns += 1;
        return Promise.resolve();
      },
      remoteSession: null,
      activeHostId: "local",
    },
    updater: { start: vi.fn() },
  }),
}));
vi.mock("#main/update/electron-updater", () => ({ createElectronUpdaterPort: () => ({}) }));
vi.mock("#main/ipc", () => ({ registerIpc: vi.fn() }));
vi.mock("#main/ipc-actions", () => ({ buildIpcActions: () => ({}) }));
vi.mock("#main/menu", () => ({ installApplicationMenu: vi.fn() }));
vi.mock("#main/protocol", () => ({ serveAppScheme: vi.fn() }));
vi.mock("#main/security", () => ({
  hardenWebContents: vi.fn(),
  resolveAllowedOrigins: vi.fn(() => []),
}));
vi.mock("#main/windows", () => ({
  createCockpitWindow: () => {
    harness.cockpit.created += 1;
    return {
      on: (event: string, listener: (payload: { preventDefault(): void }) => void) => {
        if (event === "close") harness.cockpit.close = listener;
      },
      isMinimized: () => false,
      restore: vi.fn(),
      show: () => {
        harness.cockpit.hidden = false;
        harness.cockpit.shown += 1;
      },
      focus: vi.fn(),
      hide: () => {
        harness.cockpit.hidden = true;
      },
      webContents: {
        isDestroyed: () => false,
        send: (channel: string, payload: unknown) =>
          harness.cockpit.sent.push({ channel, payload }),
        reload: vi.fn(),
      },
    };
  },
  createSplashWindow: () =>
    Promise.resolve({
      close: vi.fn(),
      focus: vi.fn(),
      restore: vi.fn(),
      isDestroyed: () => false,
      isMinimized: () => false,
      webContents: { send: vi.fn() },
    }),
}));
vi.mock("#shared/user-path", () => ({ resolveUserPath: () => "/usr/bin" }));

import { DesktopApp } from "#main/app";
import { registerQuitHandlers } from "#main/quit";
import { devBuildInfo } from "#shared/build-info";

const KEEP_RUNNING = 0;
const STOP_AND_QUIT = 1;
const CANCEL = 2;

async function launch(): Promise<DesktopApp> {
  let beforeQuit: ((event: { preventDefault(): void }) => void) | null = null;
  const desktop = new DesktopApp(devAppPaths(), devBuildInfo("0.1.0", "44.1.1"));
  harness.requestQuit = () => {
    let prevented = false;
    beforeQuit?.({
      preventDefault: () => {
        prevented = true;
      },
    });
    if (!prevented) harness.exits += 1;
  };
  registerQuitHandlers(
    {
      on: (_event, listener) => {
        beforeQuit = listener;
      },
      quit: () => harness.requestQuit(),
    },
    { once: vi.fn() },
    () => ({ gate: desktop.background, sequence: desktop.quit }),
  );
  await desktop.onReady();
  return desktop;
}

/** The close is only ever held: the operator's answer decides, so the listener must prevent it. */
function closeWindow(): void {
  const preventDefault = vi.fn();
  harness.cockpit.close?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
}

function clickTray(label: string): void {
  const entry = harness.trayMenu.find((item) => item.label?.startsWith(label) === true);
  if (entry?.click === undefined) throw new Error(`no menu-bar item labelled ${label}`);
  entry.click();
}

beforeEach(() => {
  harness.answers = [];
  harness.dialogs = 0;
  harness.exits = 0;
  harness.daemonStops = 0;
  harness.hostShutdowns = 0;
  harness.trayTitles = [];
  harness.trayMenu = [];
  harness.traysDestroyed = 0;
  harness.cockpit = { close: null, created: 0, hidden: false, shown: 0, sent: [] };
});

it("keeps the daemon and its runs going when the closed window is sent to the background", async () => {
  const desktop = await launch();
  harness.answers.push(KEEP_RUNNING);

  closeWindow();

  await vi.waitFor(() => expect(harness.cockpit.hidden).toBe(true));
  expect(harness.daemonStops).toBe(0);
  expect(harness.hostShutdowns).toBe(0);
  expect(harness.exits).toBe(0);
  expect(harness.trayTitles.at(-1)).toBe("1");
  expect(harness.dialogs).toBe(1);
  desktop.background.forceQuit();
});

it("offers the background to a quit the operator asked for, and honours it", async () => {
  const desktop = await launch();
  harness.answers.push(KEEP_RUNNING);

  harness.requestQuit();

  await vi.waitFor(() => expect(harness.cockpit.hidden).toBe(true));
  expect(harness.daemonStops).toBe(0);
  expect(harness.exits).toBe(0);
  expect(harness.trayMenu.map((item) => item.label)).toContain("Quit Otomat");
  expect(harness.dialogs).toBe(1);
  desktop.background.forceQuit();
});

it("restores the same window from the menu bar, on the run the operator picked", async () => {
  const desktop = await launch();
  harness.answers.push(KEEP_RUNNING);
  closeWindow();
  await vi.waitFor(() => expect(harness.trayMenu.length).toBeGreaterThan(0));

  clickTray("OTO-169 · Otomat · Local");

  expect(harness.cockpit.hidden).toBe(false);
  expect(harness.cockpit.shown).toBe(1);
  expect(harness.traysDestroyed).toBe(1);
  expect(harness.cockpit.sent.at(-1)).toEqual({ channel: "otomat:open-run", payload: "run-42" });
  expect(harness.cockpit.created).toBe(1);
  desktop.background.forceQuit();
});

it("brings the same window back from the menu bar's Open Otomat", async () => {
  const desktop = await launch();
  harness.answers.push(KEEP_RUNNING);
  closeWindow();
  await vi.waitFor(() => expect(harness.trayMenu.length).toBeGreaterThan(0));

  clickTray("Open Otomat");

  expect(harness.cockpit.hidden).toBe(false);
  expect(harness.cockpit.created).toBe(1);
  expect(harness.traysDestroyed).toBe(1);
  desktop.background.forceQuit();
});

it("holds the menu bar's Quit to the same contract as every other quit", async () => {
  const desktop = await launch();
  harness.answers.push(KEEP_RUNNING);
  closeWindow();
  await vi.waitFor(() => expect(harness.trayMenu.length).toBeGreaterThan(0));
  harness.answers.push(STOP_AND_QUIT);

  clickTray("Quit Otomat");

  await vi.waitFor(() => expect(harness.exits).toBe(1));
  expect(harness.dialogs).toBe(2);
  expect(harness.daemonStops).toBe(1);
  expect(harness.hostShutdowns).toBe(1);
  desktop.background.forceQuit();
});

it("stops the daemon and the hosts once, then exits, when the operator quits for real", async () => {
  await launch();
  harness.answers.push(STOP_AND_QUIT);

  harness.requestQuit();

  await vi.waitFor(() => expect(harness.exits).toBe(1));
  expect(harness.daemonStops).toBe(1);
  expect(harness.hostShutdowns).toBe(1);
  expect(harness.cockpit.hidden).toBe(false);
  expect(harness.dialogs).toBe(1);
});

it("changes nothing when the operator cancels the quit", async () => {
  const desktop = await launch();
  harness.answers.push(CANCEL);

  harness.requestQuit();

  await vi.waitFor(() => expect(harness.answers).toHaveLength(0));
  expect(harness.daemonStops).toBe(0);
  expect(harness.exits).toBe(0);
  expect(harness.cockpit.hidden).toBe(false);
  expect(harness.trayMenu).toHaveLength(0);
  expect(harness.dialogs).toBe(1);
  desktop.background.forceQuit();
});
