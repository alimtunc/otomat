import type { OtomatDesktopBridge } from "@otomat/domain";
import { afterEach, expect, it, vi } from "vitest";

import {
  BUILD_SYNC_CHANNEL,
  DAEMON_TOKEN_CHANGED_CHANNEL,
  DAEMON_TOKEN_CHANNEL,
  DAEMON_URL_CHANNEL,
  EXECUTION_HOST_SYNC_CHANNEL,
  PREVIEW_SYNC_CHANNEL,
} from "#shared/ipc-channels";

const BUILD = { version: "0.1.0", commit: "abc1234", channel: "local" };

afterEach(() => {
  vi.doUnmock("electron");
  vi.resetModules();
});

function mockElectron(sendSync: (typeof import("electron"))["ipcRenderer"]["sendSync"]) {
  const exposeInMainWorld = vi.fn<(key: string, api: OtomatDesktopBridge) => void>();
  const on = vi.fn<(channel: string, listener: (event: unknown, token: string) => void) => void>();
  vi.doMock("electron", () => ({
    contextBridge: { exposeInMainWorld },
    ipcRenderer: {
      invoke: vi.fn(),
      on,
      off: vi.fn(),
      sendSync,
    },
  }));
  return { exposeInMainWorld, on };
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

it("rejects an invalid preview flag before exposing the cockpit bridge", async () => {
  const { exposeInMainWorld } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:4319";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "local", ssh_alias: null };
    return "yes";
  });

  await expect(import("#preload/cockpit")).rejects.toThrow(/preview flag/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});

it("rejects invalid build metadata before exposing the cockpit bridge", async () => {
  const { exposeInMainWorld } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:4319";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "local", ssh_alias: null };
    if (channel === PREVIEW_SYNC_CHANNEL) return false;
    return { version: 1, commit: "abc1234", channel: "local" };
  });

  await expect(import("#preload/cockpit")).rejects.toThrow(/build metadata/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});

it("rejects an invalid daemon token before exposing the cockpit bridge", async () => {
  const { exposeInMainWorld } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:4319";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "local", ssh_alias: null };
    if (channel === PREVIEW_SYNC_CHANNEL) return false;
    if (channel === BUILD_SYNC_CHANNEL) return BUILD;
    return null;
  });

  await expect(import("#preload/cockpit")).rejects.toThrow(/daemon token/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});

it("hands the renderer the token the main process last pushed", async () => {
  const { exposeInMainWorld, on } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:4319";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "local", ssh_alias: null };
    if (channel === PREVIEW_SYNC_CHANNEL) return false;
    if (channel === BUILD_SYNC_CHANNEL) return BUILD;
    if (channel === DAEMON_TOKEN_CHANNEL) return "first-token";
    return undefined;
  });

  await import("#preload/cockpit");
  const bridge = exposeInMainWorld.mock.calls[0]?.[1];
  const follow = on.mock.calls.find(([channel]) => channel === DAEMON_TOKEN_CHANGED_CHANNEL)?.[1];
  expect(bridge?.daemonToken()).toBe("first-token");
  follow?.(null, "restarted-token");
  expect(bridge?.daemonToken()).toBe("restarted-token");
});

it("exposes the daemon URL, host identity, build and support actions synchronously", async () => {
  const { exposeInMainWorld } = mockElectron((channel) => {
    if (channel === DAEMON_URL_CHANNEL) return "http://127.0.0.1:45010";
    if (channel === EXECUTION_HOST_SYNC_CHANNEL) return { id: "remote", ssh_alias: "otomat-vps" };
    if (channel === PREVIEW_SYNC_CHANNEL) return true;
    if (channel === BUILD_SYNC_CHANNEL) return BUILD;
    if (channel === DAEMON_TOKEN_CHANNEL) return "remote-token";
    return undefined;
  });

  await import("#preload/cockpit");
  expect(exposeInMainWorld).toHaveBeenCalledWith(
    "otomat",
    expect.objectContaining({
      daemonUrl: "http://127.0.0.1:45010",
      executionHostId: "remote",
      executionHostSshAlias: "otomat-vps",
      build: BUILD,
      executionHost: expect.objectContaining({ snapshot: expect.any(Function) }),
      support: expect.objectContaining({
        exportBundle: expect.any(Function),
        openReportDraft: expect.any(Function),
      }),
      preview: true,
      sandbox: expect.objectContaining({ reset: expect.any(Function) }),
    }),
  );
});
