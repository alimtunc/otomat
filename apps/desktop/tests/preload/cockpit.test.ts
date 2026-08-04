import { afterEach, expect, it, vi } from "vitest";

import { DAEMON_URL_CHANNEL, EXECUTION_HOST_SYNC_CHANNEL } from "#shared/ipc-channels";

afterEach(() => {
  vi.doUnmock("electron");
  vi.resetModules();
});

function mockElectron(sendSync: (channel: string) => unknown): { exposeInMainWorld: unknown } {
  const exposeInMainWorld = vi.fn();
  vi.doMock("electron", () => ({
    contextBridge: { exposeInMainWorld },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      sendSync,
    },
  }));
  return { exposeInMainWorld };
}

it("rejects an invalid daemon URL before exposing the cockpit bridge", async () => {
  const { exposeInMainWorld } = mockElectron(() => ({ origin: "not-a-string" }));

  await expect(import("#preload/cockpit")).rejects.toThrow(/daemon URL/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});

it("rejects an invalid execution-host state before exposing the cockpit bridge", async () => {
  const { exposeInMainWorld } = mockElectron((channel) =>
    channel === DAEMON_URL_CHANNEL ? "http://127.0.0.1:4319" : { id: "elsewhere" },
  );

  await expect(import("#preload/cockpit")).rejects.toThrow(/execution-host/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});

it("exposes the daemon URL and execution-host identity synchronously", async () => {
  const { exposeInMainWorld } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:45010";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "remote", ssh_alias: "otomat-vps" };
    return undefined;
  });

  await import("#preload/cockpit");
  expect(exposeInMainWorld).toHaveBeenCalledWith(
    "otomat",
    expect.objectContaining({
      daemonUrl: "http://127.0.0.1:45010",
      executionHostId: "remote",
      executionHostSshAlias: "otomat-vps",
      executionHost: expect.objectContaining({ snapshot: expect.any(Function) }),
    }),
  );
});
