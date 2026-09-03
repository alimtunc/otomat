import { afterEach, expect, it, vi } from "vitest";

import { devAppPaths } from "#support/app-paths";

const PATHS = devAppPaths();

const harness = vi.hoisted(() => ({
  lock: true,
  listeners: new Map<string, () => void>(),
  quit: vi.fn(),
  focusPrimary: vi.fn(),
  registerQuitHandlers: vi.fn(),
  constructed: 0,
}));

vi.mock("electron", () => ({
  app: {
    commandLine: { hasSwitch: () => false },
    getPath: () => "/tmp/appData",
    getVersion: () => "0.0.0-test",
    isPackaged: false,
    requestSingleInstanceLock: () => harness.lock,
    quit: harness.quit,
    on: (event: string, listener: () => void) => harness.listeners.set(event, listener),
    whenReady: () => Promise.resolve(),
  },
}));
vi.mock("#main/app", () => ({
  DesktopApp: class {
    readonly quit = { begin: vi.fn() };
    readonly background = { allowQuit: () => true, forceQuit: vi.fn() };
    constructor() {
      harness.constructed += 1;
    }
    onReady(): Promise<void> {
      return Promise.resolve();
    }
    focusPrimary(): void {
      harness.focusPrimary();
    }
  },
}));
vi.mock("#main/paths", () => ({ resolveAppPaths: () => PATHS }));
vi.mock("#main/protocol", () => ({ registerAppSchemePrivileged: vi.fn() }));
vi.mock("#main/quit", () => ({ registerQuitHandlers: harness.registerQuitHandlers }));
vi.mock("#main/user-data-root", () => ({ applyUserDataRoot: vi.fn() }));

afterEach(() => {
  harness.listeners.clear();
  harness.quit.mockClear();
  harness.focusPrimary.mockClear();
  harness.registerQuitHandlers.mockClear();
  harness.constructed = 0;
  vi.resetModules();
});

it("quits a second launch instead of starting a second shell and a second daemon", async () => {
  harness.lock = false;

  await import("#main/index");

  expect(harness.quit).toHaveBeenCalledOnce();
  expect(harness.constructed).toBe(0);
  expect(harness.listeners.size).toBe(0);
});

it("reopens the running instance when Otomat is launched or activated again", async () => {
  harness.lock = true;

  await import("#main/index");

  await vi.waitFor(() => expect(harness.constructed).toBe(1));
  harness.listeners.get("second-instance")?.();
  harness.listeners.get("activate")?.();

  expect(harness.focusPrimary).toHaveBeenCalledTimes(2);
  expect(harness.quit).not.toHaveBeenCalled();
});

it("hands the quit handlers the background gate and the shutdown sequence, once there is one", async () => {
  harness.lock = true;

  await import("#main/index");
  const [, , handlers] = harness.registerQuitHandlers.mock.calls[0] ?? [];

  await vi.waitFor(() => expect(harness.constructed).toBe(1));
  expect(handlers()).toMatchObject({
    gate: { allowQuit: expect.any(Function), forceQuit: expect.any(Function) },
    sequence: { begin: expect.any(Function) },
  });
});
