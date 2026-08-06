import { afterEach, expect, it, vi } from "vitest";

import { LinearCoordinator } from "#main/linear/coordinator";
import type { LinearVault } from "#shared/linear-vault";
import {
  CONNECTED,
  DISCONNECTED,
  FakeDaemon,
  harness,
  LOCAL_URL,
  memoryVault,
  reachable,
  REMOTE_URL,
  routeDaemons,
  unreachable,
} from "#support/linear-daemons";

const HOST_DOWN = "otomat-vps is not connected yet.";

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

function localOnly(vault: LinearVault): LinearCoordinator {
  return new LinearCoordinator({
    vault,
    targets: () => [reachable("local", LOCAL_URL)],
    onDelivery: () => undefined,
  });
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
    .mockResolvedValueOnce(Response.json(DISCONNECTED));
  vi.stubGlobal("fetch", fetch);
  const vault = memoryVault();
  const coordinator = localOnly(vault);

  const save = coordinator.save("first-key");
  const forget = coordinator.forget();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  connectResponse.resolve(Response.json(CONNECTED));

  await expect(save).resolves.toEqual({ ok: true, message: null });
  await expect(forget).resolves.toEqual({ ok: true, message: null });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vault.stored()).toBeNull();
});

it("reports a vault deletion failure without disconnecting any daemon", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const vault: LinearVault = {
    clear: () => {
      throw new Error("keychain unavailable");
    },
    load: () => null,
    save: vi.fn(),
  };

  await expect(localOnly(vault).forget()).resolves.toEqual({
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

  await expect(localOnly(vault).save("first-key")).resolves.toEqual({
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

  await expect(localOnly(vault).reconcile()).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(
    "[otomat-desktop] restoring the Linear connection failed",
    decryptionError,
  );
});

it("hands one saved key to every reachable host", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  await expect(app.coordinator.save("lin_api_key")).resolves.toEqual({ ok: true, message: null });

  expect(local.connectCount).toBe(1);
  expect(remote.connectCount).toBe(1);
  expect(local.key).toBe("lin_api_key");
  expect(remote.key).toBe("lin_api_key");
  expect(vault.stored()).toBe("lin_api_key");
  expect(app.state("local")).toBe("delivered");
  expect(app.state("remote")).toBe("delivered");

  // A host that stops answering can no longer be reported as delivered, only as unreachable.
  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.reconcile();
  expect(app.state("remote")).toBe("unavailable");
});

it("restores the vaulted key on every host at boot", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault("lin_api_key"), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);

  await app.coordinator.reconcile();

  expect(local.connectCount).toBe(1);
  expect(remote.connectCount).toBe(1);
  expect(app.state("remote")).toBe("delivered");
});

it("revokes a key a daemon kept from an earlier desktop session", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  // The VPS daemon outlives the app: it still holds a key this machine has forgotten.
  remote.connected = true;
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);

  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(1);
  expect(remote.connected).toBe(false);
  expect(local.disconnectCount).toBe(0);
  expect(app.state("remote")).toBe("cleared");
});

it("keeps Linear working locally while the remote host is down, and delivers it on reconnect", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    unreachable("remote", HOST_DOWN),
  ]);

  await expect(app.coordinator.save("lin_api_key")).resolves.toEqual({ ok: true, message: null });
  expect(local.connected).toBe(true);
  expect(remote.connectCount).toBe(0);
  expect(app.state("local")).toBe("delivered");
  expect(app.state("remote")).toBe("pending_restore");

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.connectCount).toBe(1);
  expect(app.state("remote")).toBe("delivered");
});

it("re-delivers to a remote daemon that restarted, and leaves a healthy one alone", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save("lin_api_key");

  await app.coordinator.reconcile();
  expect(remote.connectCount).toBe(1);

  // The VPS daemon restarted: it answers again, with no credential in memory.
  remote.connected = false;
  await app.coordinator.reconcile();

  expect(remote.connectCount).toBe(2);
  expect(app.state("remote")).toBe("delivered");
});

it("replaces a key the remote host still holds after it was rotated offline", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save("first-key");

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.save("second-key");
  expect(remote.connectCount).toBe(1);

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  // The daemon still reported `connected` from the first key: the rotation must overwrite it.
  expect(remote.connectCount).toBe(2);
  expect(remote.key).toBe("second-key");
  expect(app.state("remote")).toBe("delivered");
});

it("refuses a save no daemon could validate instead of storing an unchecked key", async () => {
  routeDaemons([]);
  const vault = memoryVault();
  const app = harness(vault, [
    unreachable("local", "The local daemon is not running yet."),
    unreachable("remote", HOST_DOWN),
  ]);

  await expect(app.coordinator.save("lin_api_key")).resolves.toEqual({
    ok: false,
    message: "No daemon could take the Linear key. Check that a host is reachable, then retry.",
    error_code: null,
  });
  expect(vault.stored()).toBeNull();
  expect(app.state("local")).toBe("unavailable");
});

it("reports a partial disconnect and revokes on the host's next connection", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.save("lin_api_key");

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  const forgotten = await app.coordinator.forget();

  expect(forgotten.ok).toBe(false);
  expect(forgotten.message).toContain("otomat-vps");
  expect(vault.stored()).toBeNull();
  expect(local.connected).toBe(false);
  expect(remote.connected).toBe(true);
  expect(app.state("remote")).toBe("pending_revocation");

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(1);
  expect(remote.connected).toBe(false);
  expect(app.state("remote")).toBe("cleared");
});

it("publishes every delivery change so the cockpit never shows a stale host", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    unreachable("remote", HOST_DOWN),
  ]);

  await app.coordinator.save("lin_api_key");

  expect(app.deliveries.at(-1)).toEqual({
    stored: true,
    hosts: [
      { host_id: "local", label: "Local", state: "delivered", detail: null },
      { host_id: "remote", label: "otomat-vps", state: "pending_restore", detail: HOST_DOWN },
    ],
  });
});

it("puts the vaulted key back on every host when a rotation is refused", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.save("good-key");
  local.rejects = "rotated-key";
  remote.rejects = "rotated-key";

  const refused = await app.coordinator.save("rotated-key");

  expect(refused).toEqual({
    ok: false,
    message: "Linear rejected the API key.",
    error_code: "linear_unauthorized",
  });
  expect(vault.stored()).toBe("good-key");
  // The refused push already cleared both daemons, so the key still in the vault must go back.
  expect(local.connected).toBe(true);
  expect(remote.connected).toBe(true);
  expect(app.state("local")).toBe("delivered");
  expect(app.state("remote")).toBe("delivered");
});

it("clears every daemon it just fed when the vault refuses the key", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault: LinearVault = {
    clear: vi.fn(),
    load: () => null,
    save: () => {
      throw new Error("keychain unavailable");
    },
  };
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  await expect(app.coordinator.save("lin_api_key")).resolves.toEqual({
    ok: false,
    message: "keychain unavailable",
    error_code: null,
  });

  expect(local.disconnectCount).toBe(1);
  expect(remote.disconnectCount).toBe(1);
  expect(local.connected).toBe(false);
  expect(remote.connected).toBe(false);
  expect(app.state("remote")).toBe("cleared");
});

it("reports the host whose key could not be rolled back", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault: LinearVault = {
    clear: vi.fn(),
    load: () => null,
    save: () => {
      // The remote host drops in the same moment the vault write fails.
      routeDaemons([local]);
      throw new Error("keychain unavailable");
    },
  };
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  const saved = await app.coordinator.save("lin_api_key");

  expect(saved.ok).toBe(false);
  expect(saved.message).toContain("could not be rolled back");
  expect(local.connected).toBe(false);
  expect(remote.connected).toBe(true);
  expect(app.state("remote")).toBe("pending_revocation");
  expect(log).toHaveBeenCalled();
});

it("stops reporting a host as delivered once its daemon stops answering", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save("lin_api_key");
  expect(app.state("remote")).toBe("delivered");

  // The tunnel still looks up to the host manager, but the daemon behind it is gone.
  routeDaemons([local]);
  await app.coordinator.reconcile();

  expect(app.state("remote")).toBe("pending_restore");
});

it("still owes a revocation to a host whose daemon stops answering", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save("lin_api_key");

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.forget();
  expect(app.state("remote")).toBe("pending_revocation");

  // The tunnel is back, but the daemon behind it does not answer: the key may still be live there.
  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  routeDaemons([local]);
  await app.coordinator.reconcile();

  expect(app.state("remote")).toBe("pending_revocation");
  expect(remote.disconnectCount).toBe(0);
});
