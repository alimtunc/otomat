import { afterEach, expect, it, vi } from "vitest";

import { LinearCoordinator } from "#main/linear-coordinator";
import type { LinearVault } from "#shared/linear-vault";

const CONNECTED = {
  status: "connected",
  workspace_id: "workspace-1",
  workspace_name: "Otomat",
  user_name: "Alim",
  error_code: null,
  error_message: null,
} as const;

function uninitializedDeferred(): never {
  throw new Error("Deferred promise did not initialize");
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = uninitializedDeferred;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function memoryVault() {
  let stored: string | null = null;
  const vault: LinearVault = {
    clear: () => (stored = null),
    load: () => stored,
    save: (apiKey) => (stored = apiKey),
  };
  return { vault, stored: () => stored };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("serializes save then forget so a delayed connect cannot restore a forgotten key", async () => {
  const connectResponse = deferred<Response>();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(() => connectResponse.promise)
    .mockResolvedValueOnce(
      Response.json({
        status: "disconnected",
        workspace_id: null,
        workspace_name: null,
        user_name: null,
        error_code: null,
        error_message: null,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const memory = memoryVault();
  const coordinator = new LinearCoordinator(memory.vault, () => "http://127.0.0.1:4319");

  const save = coordinator.save("first-key");
  const forget = coordinator.forget();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  connectResponse.resolve(Response.json(CONNECTED));

  await expect(save).resolves.toEqual({ ok: true, message: null });
  await expect(forget).resolves.toEqual({ ok: true, message: null });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(memory.stored()).toBeNull();
});

it("reports a vault deletion failure without disconnecting the daemon", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const vault: LinearVault = {
    clear: () => {
      throw new Error("keychain unavailable");
    },
    load: () => null,
    save: vi.fn(),
  };
  const coordinator = new LinearCoordinator(vault, () => "http://127.0.0.1:4319");

  await expect(coordinator.forget()).resolves.toEqual({
    ok: false,
    message: "keychain unavailable",
    error_code: null,
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("never persists a key when the daemon rejects its superseded connection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "linear_request_superseded",
          message: "A newer Linear connection state replaced this request.",
        },
        { status: 409 },
      ),
    ),
  );
  const save = vi.fn();
  const vault: LinearVault = { clear: vi.fn(), load: () => null, save };
  const coordinator = new LinearCoordinator(vault, () => "http://127.0.0.1:4319");

  await expect(coordinator.save("first-key")).resolves.toEqual({
    ok: false,
    message: "A newer Linear connection state replaced this request.",
    error_code: "linear_request_superseded",
  });
  expect(save).not.toHaveBeenCalled();
});

it("logs the restoration cause without rejecting desktop startup", async () => {
  const decryptionError = new Error("decryption failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const vault: LinearVault = {
    clear: vi.fn(),
    load: () => {
      throw decryptionError;
    },
    save: vi.fn(),
  };
  const coordinator = new LinearCoordinator(vault, () => "http://127.0.0.1:4319");

  await expect(coordinator.restore()).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(
    "[otomat-desktop] restoring the Linear connection failed",
    decryptionError,
  );
});
