import { expect, it, vi } from "vitest";

import { HostCapacityActions } from "#main/remote/host/capacity";

const CAPACITY = { max_concurrent_sessions: 6, active_sessions: 2, waiting_sessions: 0 };

const CONNECTED = { url: "http://127.0.0.1:4319" };

const OFFLINE = () => ({ message: "The remote host is not connected yet." });

type DaemonUrl = () => { url: string } | { message: string };

/** `fetchImpl` arrives as the raw vitest mock so the tests can assert on it; only the seam is cast. */
function actions(fetchImpl: unknown, daemonUrl: DaemonUrl = () => CONNECTED) {
  const logs: string[] = [];
  const log = (message: string): void => {
    logs.push(message);
  };
  // SAFETY: the raw vitest mock stands in for fetch so the tests can assert on it.
  return {
    capacity: new HostCapacityActions({ daemonUrl, fetchImpl: fetchImpl as typeof fetch, log }),
    logs,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

it("reads the cap from the host's own daemon", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(CAPACITY)));

  expect(await actions(fetchImpl).capacity.read("remote")).toEqual({
    ok: true,
    capacity: CAPACITY,
  });
  expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:4319/api/settings/capacity", undefined);
});

it("writes the cap to the host that enforces it, as a PUT it can validate", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(CAPACITY)));

  expect(await actions(fetchImpl).capacity.write("remote", 6)).toEqual({
    ok: true,
    capacity: CAPACITY,
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:4319/api/settings/capacity",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ max_concurrent_sessions: 6 }),
    }),
  );
});

it("reports an unreachable host instead of pretending the value was applied", async () => {
  const fetchImpl = vi.fn(() => Promise.reject(new Error("tunnel closed")));
  const { capacity, logs } = actions(fetchImpl);

  const result = await capacity.write("remote", 6);

  expect(result.ok).toBe(false);
  expect(result).toMatchObject({ message: expect.stringContaining("tunnel closed") });
  expect(logs.join("\n")).toContain("tunnel closed");
});

it("says the host is not connected without ever issuing a request", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(CAPACITY)));

  expect(await actions(fetchImpl, OFFLINE).capacity.read("remote")).toEqual({
    ok: false,
    message: "The remote host is not connected yet.",
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("surfaces a refused save with the status the daemon answered", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ error: "bad" }, 400)));

  expect(await actions(fetchImpl).capacity.write("local", 0)).toEqual({
    ok: false,
    message: "The local daemon refused the capacity change (HTTP 400).",
  });
});

it("refuses a capacity payload it cannot recognize", async () => {
  const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ slots: 6 })));

  expect(await actions(fetchImpl).capacity.read("local")).toEqual({
    ok: false,
    message: "The local daemon answered in an unknown format.",
  });
});
