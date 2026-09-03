import { countWorkspaces, type RemoteHostStatus } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import { HostCatalog, type HostCatalogOptions } from "#main/remote/host/catalog";
import type { RemoteSessionHandle } from "#main/remote/session";

const LOCAL_URL = "http://127.0.0.1:4319";
const REMOTE_URL = "http://127.0.0.1:4400";

const REPOSITORY = {
  id: "r-1",
  project_id: "p-1",
  name: "otomat",
  root_path: "/home/otomat/code/otomat",
  remote_url: null,
  default_branch: "main",
  init_commands: [],
  available: true,
};

const EMPTY_INVENTORY = { entries: [], counts: countWorkspaces([]) };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function session(status: RemoteHostStatus, url: string | null): RemoteSessionHandle {
  // SAFETY: the catalog reads status and url alone; the connection methods are never called here.
  return { alias: "otomat-vps", status, url } as RemoteSessionHandle;
}

function catalog(fetchImpl: unknown, overrides: Partial<HostCatalogOptions> = {}) {
  const logs: string[] = [];
  // SAFETY: the raw vitest mock stands in for fetch so the tests can assert on it.
  const fetchSeam = fetchImpl as typeof fetch;
  return {
    logs,
    catalog: new HostCatalog({
      localDaemonUrl: () => LOCAL_URL,
      activeHostId: () => "local",
      remoteSshAlias: () => "otomat-vps",
      remoteSession: () => session({ phase: "connected", detail: null }, REMOTE_URL),
      warmRemote: () => {},
      fetchImpl: fetchSeam,
      log: (message) => logs.push(message),
      ...overrides,
    }),
  };
}

it("lists every host's own repositories, naming the host that answered", async () => {
  const fetchImpl = vi.fn((url: string) =>
    Promise.resolve(
      jsonResponse(url.startsWith(LOCAL_URL) ? [REPOSITORY] : [{ ...REPOSITORY, id: "r-2" }]),
    ),
  );

  const entries = await catalog(fetchImpl).catalog.listRepositories();

  expect(entries.map((entry) => [entry.host.id, entry.host.label, entry.active])).toEqual([
    ["local", "Local", true],
    ["remote", "otomat-vps", false],
  ]);
  expect(entries[0]?.repositories?.map((row) => row.id)).toEqual(["r-1"]);
  expect(entries[1]?.repositories?.map((row) => row.id)).toEqual(["r-2"]);
  expect(fetchImpl).toHaveBeenCalledWith(`${LOCAL_URL}/api/repositories`, undefined);
  expect(fetchImpl).toHaveBeenCalledWith(`${REMOTE_URL}/api/repositories`, undefined);
});

it("reads null for a host whose tunnel is down, never an empty list", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse([REPOSITORY])));
  const disconnected = { phase: "error", code: "ssh_unreachable", detail: null } as const;

  const entries = await catalog(fetchImpl, {
    remoteSession: () => session(disconnected, null),
  }).catalog.listRepositories();

  expect(entries[1]?.repositories).toBeNull();
  expect(entries[1]?.status).toEqual(disconnected);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it("deletes on the owning host alone", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  expect(await catalog(fetchImpl).catalog.deleteRepository("remote", "r-2")).toEqual({ ok: true });
  expect(fetchImpl).toHaveBeenCalledWith(
    `${REMOTE_URL}/api/repositories/r-2`,
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("forwards the owning host's refusal instead of deleting anywhere else", async () => {
  const fetchImpl = vi.fn(() =>
    Promise.resolve(
      jsonResponse(
        {
          error: "repository_has_active_runs",
          message: "Finish or abort this repository's active runs before deleting it.",
        },
        409,
      ),
    ),
  );

  expect(await catalog(fetchImpl).catalog.deleteRepository("remote", "r-2")).toEqual({
    ok: false,
    message: "Finish or abort this repository's active runs before deleting it.",
  });
});

it("refuses a delete on a host it cannot reach rather than falling back to the local daemon", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  const result = await catalog(fetchImpl, {
    remoteSession: () => session({ phase: "disconnected", detail: null }, null),
  }).catalog.deleteRepository("remote", "r-2");

  expect(result).toEqual({
    ok: false,
    message: "The remote host is not connected yet. Try again once its tunnel is up.",
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("reads the worktrees of the host that was named, on that host alone", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(EMPTY_INVENTORY)));

  const result = await catalog(fetchImpl).catalog.readWorkspaces("remote");

  expect(result).toEqual({ ok: true, value: EMPTY_INVENTORY });
  expect(fetchImpl).toHaveBeenCalledWith(`${REMOTE_URL}/api/workspaces`, undefined);
});

it("reads the Inbox of the host that was named, on that host alone", async () => {
  const inbox = { entries: [], observed_at: "2026-08-22T10:00:00.000Z" };
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(inbox)));

  const result = await catalog(fetchImpl).catalog.readInbox("remote");

  expect(result).toEqual({ ok: true, value: inbox });
  expect(fetchImpl).toHaveBeenCalledWith(`${REMOTE_URL}/api/inbox`, undefined);
});

it("says why an unreachable host could not be read instead of answering for it", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(EMPTY_INVENTORY)));

  const result = await catalog(fetchImpl, {
    remoteSession: () => session({ phase: "disconnected", detail: null }, null),
  }).catalog.readWorkspaces("remote");

  expect(result).toEqual({
    ok: false,
    message: "The remote host is not connected yet. Try again once its tunnel is up.",
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("reconciles and cleans on the owning host alone", async () => {
  const fetchImpl = vi.fn((url: string) =>
    Promise.resolve(
      jsonResponse(
        url.endsWith("/reconcile")
          ? {
              pull_requests_refreshed: 0,
              pruned: 0,
              converged: 0,
              cleaned: 1,
              skipped: 0,
              failed: 0,
              inventory: EMPTY_INVENTORY,
            }
          : { outcome: "cleaned", blocker: null, message: "Deleted.", entry: null },
      ),
    ),
  );
  const hosts = catalog(fetchImpl).catalog;

  const reconciled = await hosts.reconcileWorkspaces("remote");
  const cleaned = await hosts.cleanupWorkspace("remote", "w-1", true);

  expect(reconciled.ok && reconciled.value.cleaned).toBe(1);
  expect(cleaned.ok && cleaned.value.outcome).toBe("cleaned");
  expect(fetchImpl).toHaveBeenCalledWith(
    `${REMOTE_URL}/api/workspaces/reconcile`,
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetchImpl).toHaveBeenCalledWith(
    `${REMOTE_URL}/api/workspaces/w-1/cleanup`,
    expect.objectContaining({ method: "POST", body: JSON.stringify({ force: true }) }),
  );
});

it("forwards a refusal as prose rather than deleting on another host", async () => {
  const fetchImpl = vi.fn(() =>
    Promise.resolve(jsonResponse({ error: "workspace_not_found", message: "gone" }, 404)),
  );

  expect(await catalog(fetchImpl).catalog.cleanupWorkspace("remote", "w-1", false)).toEqual({
    ok: false,
    message: "The remote daemon refused the request (HTTP 404).",
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    `${REMOTE_URL}/api/workspaces/w-1/cleanup`,
    expect.objectContaining({ method: "POST" }),
  );
});
