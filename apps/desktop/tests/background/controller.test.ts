import { afterEach, expect, it, vi } from "vitest";

import {
  BackgroundMode,
  type BackgroundModeOptions,
  type BackgroundTrayPort,
} from "#main/background/controller";
import type { CloseChoice } from "#main/background/prompts";
import type { BackgroundTrayActions } from "#main/background/tray";
import type { LocalWorkItem } from "#main/background/work-items";

function item(state: LocalWorkItem["state"], runId = `run-${state}`): LocalWorkItem {
  return { run_id: runId, project: "Otomat", issue: "OTO-1", state, started_at: null };
}

const LIVE: LocalWorkItem[] = [item("running"), item("waiting")];
const IDLE: LocalWorkItem[] = [item("failed")];

const started: BackgroundMode[] = [];

function harness(overrides: Partial<BackgroundModeOptions> = {}) {
  const tray: BackgroundTrayPort = { render: vi.fn(), destroy: vi.fn() };
  let trayActions: BackgroundTrayActions | null = null;
  const options = {
    readWork: vi.fn(() => Promise.resolve({ ok: true as const, items: LIVE })),
    askCloseChoice: vi.fn(() => Promise.resolve("background" as const)),
    createTray: vi.fn((actions: BackgroundTrayActions) => {
      trayActions = actions;
      return tray;
    }),
    hideWindow: vi.fn(),
    openWindow: vi.fn(),
    openRun: vi.fn(),
    quit: vi.fn(),
    log: vi.fn(),
    ...overrides,
  } satisfies BackgroundModeOptions;
  const mode = new BackgroundMode(options);
  started.push(mode);
  return { mode, options, tray, trayActions: () => trayActions };
}

function held() {
  let settle!: (choice: CloseChoice) => void;
  const pending = new Promise<CloseChoice>((resolve) => {
    settle = resolve;
  });
  return { prompt: () => pending, settle };
}

afterEach(() => {
  for (const mode of started.splice(0)) mode.forceQuit();
  vi.useRealTimers();
});

it("hides the window instead of stopping the runs when the operator keeps them going", async () => {
  const { mode, options, tray } = harness();

  expect(mode.handleWindowClose()).toBe(true);

  await vi.waitFor(() => expect(options.hideWindow).toHaveBeenCalledOnce());
  expect(options.quit).not.toHaveBeenCalled();
  expect(options.createTray).toHaveBeenCalledOnce();
  expect(tray.render).toHaveBeenCalledWith(LIVE);
});

it("offers the same three answers to a real quit, and keeps Otomat alive on the background one", async () => {
  const { mode, options } = harness();

  expect(mode.allowQuit()).toBe(false);

  await vi.waitFor(() => expect(options.hideWindow).toHaveBeenCalledOnce());
  expect(options.askCloseChoice).toHaveBeenCalledWith(LIVE);
  expect(options.quit).not.toHaveBeenCalled();
  expect(options.createTray).toHaveBeenCalledOnce();
});

it("lets a quit through once, without asking again, when the operator stops the runs", async () => {
  const { mode, options } = harness({
    askCloseChoice: vi.fn(() => Promise.resolve("quit" as const)),
  });

  expect(mode.allowQuit()).toBe(false);

  await vi.waitFor(() => expect(options.quit).toHaveBeenCalledOnce());
  expect(mode.allowQuit()).toBe(true);
  expect(options.askCloseChoice).toHaveBeenCalledOnce();
});

it("keeps Otomat exactly as it was when the operator cancels a quit", async () => {
  const { mode, options } = harness({
    askCloseChoice: vi.fn(() => Promise.resolve("cancel" as const)),
  });

  mode.allowQuit();

  await vi.waitFor(() => expect(options.askCloseChoice).toHaveBeenCalledOnce());
  expect(options.quit).not.toHaveBeenCalled();
  expect(options.hideWindow).not.toHaveBeenCalled();
  expect(mode.allowQuit()).toBe(false);
});

it("shows the same window again on reopen and drops the menu-bar item", async () => {
  const { mode, options, tray } = harness();

  mode.handleWindowClose();
  await vi.waitFor(() => expect(options.hideWindow).toHaveBeenCalledOnce());
  mode.reopen();

  expect(options.openWindow).toHaveBeenCalledOnce();
  expect(tray.destroy).toHaveBeenCalledOnce();
});

it("reopens the window on the run the operator picked in the menu bar", async () => {
  const { mode, options, trayActions } = harness();

  mode.handleWindowClose();
  await vi.waitFor(() => expect(options.createTray).toHaveBeenCalledOnce());
  trayActions()?.openRun("run-42");

  expect(options.openWindow).toHaveBeenCalledOnce();
  expect(options.openRun).toHaveBeenCalledWith("run-42");
});

it("quits without asking when no local run is live", async () => {
  const { mode, options } = harness({
    readWork: vi.fn(() => Promise.resolve({ ok: true as const, items: IDLE })),
  });

  expect(mode.handleWindowClose()).toBe(true);

  await vi.waitFor(() => expect(options.quit).toHaveBeenCalledOnce());
  expect(options.askCloseChoice).not.toHaveBeenCalled();
});

it("lets the window close for real once the operator chose to stop the runs", async () => {
  const { mode, options } = harness({
    askCloseChoice: vi.fn(() => Promise.resolve("quit" as const)),
  });

  mode.handleWindowClose();

  await vi.waitFor(() => expect(options.quit).toHaveBeenCalledOnce());
  expect(options.hideWindow).not.toHaveBeenCalled();
  expect(mode.handleWindowClose()).toBe(false);
});

it("re-issues a quit that arrived while the operator was still choosing", async () => {
  const pending = held();
  const { mode, options } = harness({ askCloseChoice: vi.fn(pending.prompt) });

  mode.handleWindowClose();
  await vi.waitFor(() => expect(options.askCloseChoice).toHaveBeenCalledOnce());
  expect(mode.allowQuit()).toBe(false);
  pending.settle("background");

  await vi.waitFor(() => expect(options.quit).toHaveBeenCalledOnce());
  expect(options.hideWindow).toHaveBeenCalledOnce();
});

it("does not ask again when a second quit arrives while the dialog is on screen", async () => {
  const pending = held();
  const { mode, options } = harness({ askCloseChoice: vi.fn(pending.prompt) });

  expect(mode.allowQuit()).toBe(false);
  await vi.waitFor(() => expect(options.askCloseChoice).toHaveBeenCalledOnce());
  expect(mode.allowQuit()).toBe(false);
  pending.settle("cancel");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(options.askCloseChoice).toHaveBeenCalledOnce();
  expect(options.quit).not.toHaveBeenCalled();
});

it("takes SIGTERM's quit without a dialog no one can answer", () => {
  const { mode, options } = harness();

  mode.forceQuit();

  expect(mode.allowQuit()).toBe(true);
  expect(options.askCloseChoice).not.toHaveBeenCalled();
});

it("drops an answer that lands after the OS already took the process down", async () => {
  const pending = held();
  const { mode, options } = harness({ askCloseChoice: vi.fn(pending.prompt) });

  mode.handleWindowClose();
  await vi.waitFor(() => expect(options.askCloseChoice).toHaveBeenCalledOnce());
  mode.forceQuit();
  pending.settle("background");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(options.createTray).not.toHaveBeenCalled();
  expect(options.hideWindow).not.toHaveBeenCalled();
});

it("holds the window open and reports a prompt it could not show", async () => {
  const { mode, options } = harness({
    askCloseChoice: vi.fn(() => Promise.reject(new Error("no display"))),
  });

  expect(mode.handleWindowClose()).toBe(true);

  await vi.waitFor(() => expect(options.log).toHaveBeenCalledOnce());
  expect(options.quit).not.toHaveBeenCalled();
  expect(options.hideWindow).not.toHaveBeenCalled();
});

it("asks with the unreadable state named rather than counting the daemon as idle", async () => {
  const { mode, options } = harness({
    readWork: vi.fn(() => Promise.resolve({ ok: false as const, message: "daemon unreachable" })),
  });

  mode.handleWindowClose();

  await vi.waitFor(() => expect(options.askCloseChoice).toHaveBeenCalledWith(null));
  expect(options.log).toHaveBeenCalledWith("daemon unreachable");
});

it("re-reads the daemon while it runs with no window open", async () => {
  vi.useFakeTimers();
  const { mode, tray } = harness();

  mode.handleWindowClose();
  await vi.waitFor(() => expect(tray.render).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(60_000);

  expect(vi.mocked(tray.render).mock.calls.length).toBeGreaterThan(1);
});
