import type { RemoteHostStatus } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import type { RemoteSessionHandle } from "#main/remote/session";
import { StaleDaemonRefresher } from "#main/remote/stale-daemon";

type MutableFakeSession = Omit<RemoteSessionHandle, "remoteBuild"> & {
  remoteBuild: string | null;
  refreshCount: number;
};

function connectedSession(remoteBuild: string | null): MutableFakeSession {
  const session = {
    alias: "otomat-vps",
    status: { phase: "connected", detail: null } as RemoteHostStatus,
    url: "http://127.0.0.1:45010",
    remoteBuild,
    refreshCount: 0,
    ensureLocalPort: () => Promise.resolve(45_010),
    connect: () => Promise.resolve({ phase: "connected", detail: null } as RemoteHostStatus),
    refreshDaemon: () => {
      session.refreshCount += 1;
      session.remoteBuild = "abc1234";
      return Promise.resolve({ phase: "connected", detail: null } as RemoteHostStatus);
    },
    dispose: () => Promise.resolve(),
  };
  return session;
}

function runsResponse(statuses: string[]): Response {
  return { ok: true, json: async () => statuses.map((status) => ({ status })) } as Response;
}

function refresher(fetchImpl: typeof fetch, expectedBuild: string | null = "abc1234") {
  return new StaleDaemonRefresher({ expectedBuild, fetchImpl, log: () => {} });
}

it("restarts a stale daemon once it is idle, a single time per observed build", async () => {
  const fetchImpl = vi.fn(async () => runsResponse(["review_ready", "failed"]));
  const session = connectedSession("old0000");
  const stale = refresher(fetchImpl);

  await stale.maybeRefresh(session);
  expect(session.refreshCount).toBe(1);

  session.remoteBuild = "old0000";
  await stale.maybeRefresh(session);
  expect(session.refreshCount).toBe(1);
});

it("never restarts while a run is working or awaiting permission", async () => {
  for (const busy of ["queued", "preparing", "running", "awaiting_permission"]) {
    const fetchImpl = vi.fn(async () => runsResponse(["review_ready", busy]));
    const session = connectedSession("old0000");
    await refresher(fetchImpl).maybeRefresh(session);
    expect(session.refreshCount).toBe(0);
  }
});

it("stays quiet when builds match or either side is unstamped", async () => {
  const fetchImpl = vi.fn(async () => runsResponse([]));
  for (const build of ["abc1234", null]) {
    const session = connectedSession(build);
    await refresher(fetchImpl).maybeRefresh(session);
    expect(session.refreshCount).toBe(0);
  }
  const session = connectedSession("old0000");
  await refresher(fetchImpl, null).maybeRefresh(session);
  expect(session.refreshCount).toBe(0);
});

it("treats an unreachable runs endpoint as busy, never restarting on doubt", async () => {
  const fetchImpl = vi.fn(async () => {
    throw new Error("tunnel hiccup");
  });
  const session = connectedSession("old0000");
  await refresher(fetchImpl).maybeRefresh(session);
  expect(session.refreshCount).toBe(0);
});
