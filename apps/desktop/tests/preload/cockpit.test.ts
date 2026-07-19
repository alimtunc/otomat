import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("electron");
  vi.resetModules();
});

it("rejects an invalid daemon URL before exposing the cockpit bridge", async () => {
  const exposeInMainWorld = vi.fn();
  vi.doMock("electron", () => ({
    contextBridge: { exposeInMainWorld },
    ipcRenderer: {
      invoke: vi.fn(),
      sendSync: () => ({ origin: "not-a-string" }),
    },
  }));

  await expect(import("#preload/cockpit")).rejects.toThrow(/daemon URL/i);
  expect(exposeInMainWorld).not.toHaveBeenCalled();
});
