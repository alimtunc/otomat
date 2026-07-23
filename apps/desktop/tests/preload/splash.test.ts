import { afterEach, expect, it, vi } from "vitest";

import {
  SPLASH_EXPORT_SUPPORT_CHANNEL,
  SPLASH_RESTORE_CHANNEL,
  SPLASH_RETRY_CHANNEL,
  SPLASH_SHOW_POLICY_CHANNEL,
} from "#shared/startup";

afterEach(() => {
  vi.doUnmock("electron");
  vi.resetModules();
});

it("exposes bounded recovery actions over named IPC channels", async () => {
  const exposeInMainWorld = vi.fn();
  const send = vi.fn();
  const invoke = vi.fn();
  vi.doMock("electron", () => ({
    contextBridge: { exposeInMainWorld },
    ipcRenderer: { invoke, on: vi.fn(), send },
  }));

  await import("#preload/splash");
  const bridge = exposeInMainWorld.mock.calls[0]?.[1] as {
    retry(): void;
    restore(): Promise<void>;
    exportSupportBundle(): Promise<void>;
    showDataPolicy(): Promise<void>;
  };
  bridge.retry();
  await bridge.restore();
  await bridge.exportSupportBundle();
  await bridge.showDataPolicy();

  expect(send).toHaveBeenCalledWith(SPLASH_RETRY_CHANNEL);
  expect(invoke).toHaveBeenCalledWith(SPLASH_RESTORE_CHANNEL);
  expect(invoke).toHaveBeenCalledWith(SPLASH_EXPORT_SUPPORT_CHANNEL);
  expect(invoke).toHaveBeenCalledWith(SPLASH_SHOW_POLICY_CHANNEL);
});
