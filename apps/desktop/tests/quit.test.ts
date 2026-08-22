import { expect, it, vi } from "vitest";

import { QuitSequence, registerQuitHandlers, type QuittableRuntime } from "#main/quit";

function quitSequence(
  runtime: QuittableRuntime,
  log: (message: string) => void = vi.fn(),
): QuitSequence {
  return new QuitSequence(() => runtime, log);
}

function runningRuntime(stop: () => Promise<void>): QuittableRuntime {
  return {
    daemon: { running: true, stop },
    hosts: { shutdown: async () => {}, remoteSession: null },
  };
}

it("turns SIGTERM into an Electron quit request", () => {
  let onSigterm: (() => void) | undefined;
  const app = {
    on: vi.fn(),
    quit: vi.fn(),
  };
  const signals = {
    once: vi.fn((_signal: "SIGTERM", listener: () => void) => {
      onSigterm = listener;
    }),
  };

  registerQuitHandlers(app, signals, () => null);
  if (onSigterm === undefined) throw new Error("SIGTERM handler was not registered");
  onSigterm();

  expect(signals.once).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
  expect(app.quit).toHaveBeenCalledOnce();
});

it("holds Electron's quit while owned processes stop", async () => {
  let beforeQuit: ((event: { preventDefault(): void }) => void) | undefined;
  const app = {
    on: vi.fn((_event: "before-quit", listener: typeof beforeQuit) => {
      beforeQuit = listener;
    }),
    quit: vi.fn(),
  };
  const quit = quitSequence(runningRuntime(() => Promise.resolve()));
  const preventDefault = vi.fn();

  registerQuitHandlers(app, { once: vi.fn() }, () => quit);
  if (beforeQuit === undefined) throw new Error("before-quit handler was not registered");
  beforeQuit({ preventDefault });

  expect(preventDefault).toHaveBeenCalledOnce();
  await vi.waitFor(() => expect(app.quit).toHaveBeenCalledOnce());
});

it("still releases the quit when stopping the daemon fails, and names the failed phase", async () => {
  const log = vi.fn();
  const quit = quitSequence(
    runningRuntime(() => Promise.reject(new Error("still running"))),
    log,
  );
  const done = vi.fn();

  expect(quit.begin(done)).toBe(true);
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(log).toHaveBeenCalledWith("Quit phase: stopping the local daemon.");
  expect(log).toHaveBeenCalledWith("Daemon stop failed during quit: Error: still running");
  expect(quit.begin(done)).toBe(false);
});

it("stops the daemon once and lets the quit it released through", async () => {
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const quit = quitSequence(runningRuntime(stop));
  const done = vi.fn();

  expect(quit.begin(done)).toBe(true);
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(quit.begin(done)).toBe(false);
  expect(stop).toHaveBeenCalledOnce();
});

it("blocks further quit requests while one shutdown is in flight", async () => {
  let release: (() => void) | undefined;
  const stop = vi.fn<() => Promise<void>>(
    () =>
      new Promise((resolve) => {
        release = () => resolve();
      }),
  );
  const quit = quitSequence(runningRuntime(stop));
  const done = vi.fn();

  expect(quit.begin(done)).toBe(true);
  await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
  expect(quit.begin(done)).toBe(true);
  expect(done).not.toHaveBeenCalled();

  release?.();
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(stop).toHaveBeenCalledOnce();
});

it("stops the local daemon even when the remote hosts refuse to shut down", async () => {
  const log = vi.fn();
  const stop = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const quit = quitSequence(
    {
      daemon: { running: true, stop },
      hosts: {
        shutdown: () => Promise.reject(new Error("tunnel stuck")),
        remoteSession: { alias: "vps" },
      },
    },
    log,
  );
  const done = vi.fn();

  expect(quit.begin(done)).toBe(true);
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(log).toHaveBeenCalledWith("Tunnel stop failed during quit: Error: tunnel stuck");
  expect(stop).toHaveBeenCalledOnce();
});

it("stops the remote hosts even when the local daemon is already gone", async () => {
  const shutdown = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const quit = quitSequence({
    daemon: { running: false, stop: async () => {} },
    hosts: { shutdown, remoteSession: { alias: "vps" } },
  });
  const done = vi.fn();

  expect(quit.begin(done)).toBe(true);
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(shutdown).toHaveBeenCalledOnce();
});

it("leaves the quit alone when it owns no daemon and no remote session", () => {
  const quit = quitSequence({
    daemon: { running: false, stop: async () => {} },
    hosts: { shutdown: async () => {}, remoteSession: null },
  });
  const done = vi.fn();

  expect(quit.begin(done)).toBe(false);
  expect(done).not.toHaveBeenCalled();
});
