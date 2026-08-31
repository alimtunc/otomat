import { afterEach, expect, it, vi } from "vitest";

import { LinearCoordinator } from "#main/linear/coordinator";
import type { LinearVault } from "#shared/linear-vault";
import {
  connected,
  CRM,
  FakeDaemon,
  harness,
  LOCAL_URL,
  memoryVault,
  OTOMAT,
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
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  const vault = memoryVault();
  const coordinator = localOnly(vault);

  const save = coordinator.save(OTOMAT);
  const forget = coordinator.forget(OTOMAT.id);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  connectResponse.resolve(Response.json(connected(OTOMAT.id, OTOMAT.label)));

  await expect(save).resolves.toEqual({ ok: true, message: null });
  await expect(forget).resolves.toEqual({ ok: true, message: null });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vault.stored()).toEqual({});
});

it("reports a vault deletion failure without disconnecting any daemon", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const vault: LinearVault = {
    forget: () => {
      throw new Error("keychain unavailable");
    },
    load: () => ({}),
    save: vi.fn(),
  };

  await expect(localOnly(vault).forget(OTOMAT.id)).resolves.toEqual({
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
  const vault: LinearVault = { forget: vi.fn(), load: () => ({}), save };

  await expect(localOnly(vault).save(OTOMAT)).resolves.toEqual({
    ok: false,
    message: "A newer Linear connection state replaced this request.",
    error_code: "linear_request_superseded",
  });
  expect(save).not.toHaveBeenCalled();
});

it("logs an unreadable vault without rejecting desktop startup", async () => {
  const decryptionError = new Error("decryption failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const vault: LinearVault = {
    forget: vi.fn(),
    load: () => {
      throw decryptionError;
    },
    save: vi.fn(),
  };

  await expect(localOnly(vault).reconcile()).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(
    "[otomat-desktop] reading the Linear vault failed",
    decryptionError,
  );
});

it("hands one saved key to every reachable host", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  await expect(app.coordinator.save(OTOMAT)).resolves.toEqual({ ok: true, message: null });

  expect(local.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
  expect(remote.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key });
  expect(app.state(OTOMAT.id, "local")).toBe("delivered");
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");

  // A host that stops answering can no longer be reported as delivered, only as unreachable.
  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.reconcile();
  expect(app.state(OTOMAT.id, "remote")).toBe("unavailable");
});

it("keeps two workspaces on every host without mixing their keys", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  await app.coordinator.save(OTOMAT);
  await app.coordinator.save(CRM);

  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key, [CRM.id]: CRM.api_key });
  for (const daemon of [local, remote]) {
    expect(daemon.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
    expect(daemon.keys.get(CRM.id)).toBe(CRM.api_key);
  }
  expect(app.state(CRM.id, "remote")).toBe("delivered");
});

it("leaves the other connection delivered when one is disconnected", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL)]);
  await app.coordinator.save(OTOMAT);
  await app.coordinator.save(CRM);

  await expect(app.coordinator.forget(CRM.id)).resolves.toEqual({ ok: true, message: null });

  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key });
  expect(local.holds(OTOMAT.id)).toBe(true);
  expect(local.holds(CRM.id)).toBe(false);
  expect(app.state(OTOMAT.id, "local")).toBe("delivered");
});

it("keeps a forgotten connection listed while a host still owes its revocation", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  const app = harness(memoryVault(), [reachable("local", LOCAL_URL)]);
  await app.coordinator.save(OTOMAT);

  app.setTargets([unreachable("local", HOST_DOWN)]);
  await app.coordinator.forget(OTOMAT.id);

  const owed = app.deliveries.at(-1)?.connections.find((c) => c.connection_id === OTOMAT.id);
  expect(owed).toBeDefined();
  expect(app.state(OTOMAT.id, "local")).toBe("pending_revocation");
});

it("keeps delivering the healthy connection when another one is refused", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  local.rejects = CRM.api_key;
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL)]);
  await app.coordinator.save(OTOMAT);

  const refused = await app.coordinator.save(CRM);

  expect(refused).toEqual({
    ok: false,
    message: "Linear rejected the API key.",
    error_code: "linear_unauthorized",
  });
  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key });
  expect(local.holds(OTOMAT.id)).toBe(true);
  expect(app.state(OTOMAT.id, "local")).toBe("delivered");
});

it("restores every vaulted key on every host at boot", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault({ [OTOMAT.id]: OTOMAT.api_key, [CRM.id]: CRM.api_key }), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);

  await app.coordinator.reconcile();

  expect(local.connectCount).toBe(2);
  expect(remote.connectCount).toBe(2);
  expect(app.state(CRM.id, "remote")).toBe("delivered");
});

it("revokes a key a daemon kept from an earlier desktop session", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  // The VPS daemon outlives the app: it still holds a key this machine has forgotten.
  remote.adopt(OTOMAT.id, OTOMAT.label, OTOMAT.api_key);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);

  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(1);
  expect(remote.holds(OTOMAT.id)).toBe(false);
  expect(local.disconnectCount).toBe(0);
});

it("keeps Linear working locally while the remote host is down, and delivers it on reconnect", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    unreachable("remote", HOST_DOWN),
  ]);

  await expect(app.coordinator.save(OTOMAT)).resolves.toEqual({ ok: true, message: null });
  expect(local.holds(OTOMAT.id)).toBe(true);
  expect(remote.connectCount).toBe(0);
  expect(app.state(OTOMAT.id, "local")).toBe("delivered");
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_restore");

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.connectCount).toBe(1);
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");
});

it("re-delivers to a remote daemon that restarted, and leaves a healthy one alone", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save(OTOMAT);

  await app.coordinator.reconcile();
  expect(remote.connectCount).toBe(1);

  // The VPS daemon restarted: it answers again, with no credential in memory.
  remote.keys.clear();
  await app.coordinator.reconcile();

  expect(remote.connectCount).toBe(2);
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");
});

it("replaces a key the remote host still holds after it was rotated offline", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save(OTOMAT);

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.save({ ...OTOMAT, api_key: "second-key" });
  expect(remote.connectCount).toBe(1);

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  // The daemon still reported the first key as held: the rotation must overwrite it.
  expect(remote.connectCount).toBe(2);
  expect(remote.keys.get(OTOMAT.id)).toBe("second-key");
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");
});

it("refuses a save no daemon could validate instead of storing an unchecked key", async () => {
  routeDaemons([]);
  const vault = memoryVault();
  const app = harness(vault, [
    unreachable("local", "The local daemon is not running yet."),
    unreachable("remote", HOST_DOWN),
  ]);

  await expect(app.coordinator.save(OTOMAT)).resolves.toEqual({
    ok: false,
    message: "No daemon could take the Linear key. Check that a host is reachable, then retry.",
    error_code: null,
  });
  expect(vault.stored()).toEqual({});
});

it("reports a partial disconnect and revokes on the host's next connection", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.save(OTOMAT);

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  const forgotten = await app.coordinator.forget(OTOMAT.id);

  expect(forgotten.ok).toBe(false);
  expect(forgotten.message).toContain("otomat-vps");
  expect(vault.stored()).toEqual({});
  expect(local.holds(OTOMAT.id)).toBe(false);
  expect(remote.holds(OTOMAT.id)).toBe(true);
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(1);
  expect(remote.holds(OTOMAT.id)).toBe(false);
});

it("publishes every delivery change so the cockpit never shows a stale host", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    unreachable("remote", HOST_DOWN),
  ]);

  await app.coordinator.save(OTOMAT);

  expect(app.deliveries.at(-1)).toEqual({
    connections: [
      {
        connection_id: OTOMAT.id,
        hosts: [
          { host_id: "local", label: "Local", state: "delivered", detail: null },
          { host_id: "remote", label: "otomat-vps", state: "pending_restore", detail: HOST_DOWN },
        ],
      },
    ],
  });
});

it("puts the vaulted key back on every host when a rotation is refused", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.save(OTOMAT);
  local.rejects = "rotated-key";
  remote.rejects = "rotated-key";

  const refused = await app.coordinator.save({ ...OTOMAT, api_key: "rotated-key" });

  expect(refused).toEqual({
    ok: false,
    message: "Linear rejected the API key.",
    error_code: "linear_unauthorized",
  });
  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key });
  // The refused push already cleared both daemons, so the key still in the vault must go back.
  expect(local.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
  expect(remote.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");
});

it("puts the vaulted key back when the daemons accepted a rotation the vault could not store", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  routeDaemons([local]);
  const vault = memoryVault();
  const app = harness(vault, [reachable("local", LOCAL_URL)]);
  await app.coordinator.save(OTOMAT);
  vault.save = () => {
    throw new Error("keychain unavailable");
  };

  const rotated = await app.coordinator.save({ ...OTOMAT, api_key: "rotated-key" });

  expect(rotated).toEqual({ ok: false, message: "keychain unavailable", error_code: null });
  expect(vault.stored()).toEqual({ [OTOMAT.id]: OTOMAT.api_key });
  expect(local.keys.get(OTOMAT.id)).toBe(OTOMAT.api_key);
  expect(app.state(OTOMAT.id, "local")).toBe("delivered");
});

it("revokes on a daemon that restarted before its owed revocation arrived", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save(OTOMAT);

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.forget(OTOMAT.id);
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");

  // The VPS daemon restarted: the catalogue row survived in SQLite, the key did not.
  remote.keys.clear();
  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(1);
  expect(app.state(OTOMAT.id, "remote")).toBeUndefined();
});

it("resolves an owed revocation on a host that never received the key", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    unreachable("remote", HOST_DOWN),
  ]);
  await app.coordinator.save(OTOMAT);
  await app.coordinator.forget(OTOMAT.id);
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");

  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  await app.coordinator.reconcile();

  expect(remote.disconnectCount).toBe(0);
  expect(app.state(OTOMAT.id, "remote")).toBeUndefined();
});

it("leaves every daemon untouched while the vault cannot be read", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const local = new FakeDaemon(LOCAL_URL);
  local.adopt(OTOMAT.id, OTOMAT.label, OTOMAT.api_key);
  routeDaemons([local]);
  const vault: LinearVault = {
    forget: vi.fn(),
    load: () => {
      throw new Error("decryption failed");
    },
    save: vi.fn(),
  };
  const app = harness(vault, [reachable("local", LOCAL_URL)]);

  await app.coordinator.reconcile();

  expect(local.disconnectCount).toBe(0);
  expect(local.holds(OTOMAT.id)).toBe(true);
});

it("clears every daemon it just fed when the vault refuses the key", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault: LinearVault = {
    forget: vi.fn(),
    load: () => ({}),
    save: () => {
      throw new Error("keychain unavailable");
    },
  };
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  await expect(app.coordinator.save(OTOMAT)).resolves.toEqual({
    ok: false,
    message: "keychain unavailable",
    error_code: null,
  });

  expect(local.disconnectCount).toBe(1);
  expect(remote.disconnectCount).toBe(1);
  expect(local.holds(OTOMAT.id)).toBe(false);
  expect(remote.holds(OTOMAT.id)).toBe(false);
});

it("reports the host whose key could not be rolled back", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const vault: LinearVault = {
    forget: vi.fn(),
    load: () => ({}),
    save: () => {
      // The remote host drops in the same moment the vault write fails.
      routeDaemons([local]);
      throw new Error("keychain unavailable");
    },
  };
  const app = harness(vault, [reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);

  const saved = await app.coordinator.save(OTOMAT);

  expect(saved.ok).toBe(false);
  expect(saved.message).toContain("could not be rolled back");
  expect(local.holds(OTOMAT.id)).toBe(false);
  expect(remote.holds(OTOMAT.id)).toBe(true);
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");
});

it("stops reporting a host as delivered once its daemon stops answering", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save(OTOMAT);
  expect(app.state(OTOMAT.id, "remote")).toBe("delivered");

  // The tunnel still looks up to the host manager, but the daemon behind it is gone.
  routeDaemons([local]);
  await app.coordinator.reconcile();

  expect(app.state(OTOMAT.id, "remote")).toBe("pending_restore");
});

it("still owes a revocation to a host whose daemon stops answering", async () => {
  const local = new FakeDaemon(LOCAL_URL);
  const remote = new FakeDaemon(REMOTE_URL);
  routeDaemons([local, remote]);
  const app = harness(memoryVault(), [
    reachable("local", LOCAL_URL),
    reachable("remote", REMOTE_URL),
  ]);
  await app.coordinator.save(OTOMAT);

  app.setTargets([reachable("local", LOCAL_URL), unreachable("remote", HOST_DOWN)]);
  await app.coordinator.forget(OTOMAT.id);
  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");

  // The tunnel is back, but the daemon behind it does not answer: the key may still be live there.
  app.setTargets([reachable("local", LOCAL_URL), reachable("remote", REMOTE_URL)]);
  routeDaemons([local]);
  await app.coordinator.reconcile();

  expect(app.state(OTOMAT.id, "remote")).toBe("pending_revocation");
  expect(remote.disconnectCount).toBe(0);
});
