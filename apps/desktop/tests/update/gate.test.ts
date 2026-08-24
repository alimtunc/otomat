import { expect, it } from "vitest";

import type { HostTarget } from "#main/remote/host/catalog";
import { UpdateGate } from "#main/update/gate";

const LOCAL = "http://127.0.0.1:4319";
const REMOTE = "http://127.0.0.1:5319";

function target(id: "local" | "remote", label: string, url: string | null): HostTarget {
  return {
    host: { id, label, kind: id === "local" ? "local" : "ssh" },
    active: id === "local",
    status: null,
    url,
  };
}

function json(body: unknown): Response {
  // SAFETY: the gate reads only `ok` and `json()`, both provided here.
  return { ok: true, json: async () => body } as Response;
}

function refused(): Response {
  // SAFETY: the gate reads `ok` first and stops there.
  return { ok: false } as Response;
}

function busyRuns(count: number): { id: string; status: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${String(index)}`,
    status: "running",
  }));
}

interface Call {
  url: string;
  held: boolean | null;
}

function gateWith(handler: (url: string, held: boolean | null) => Response, hosts: HostTarget[]) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    // SAFETY: every body the gate sends is the `{ held }` request it builds itself.
    const held =
      init?.body === undefined ? null : (JSON.parse(String(init.body)) as { held: boolean }).held;
    calls.push({ url, held });
    return handler(url, held);
  };
  return { gate: new UpdateGate({ hosts: () => hosts, fetchImpl, log: () => {} }), calls };
}

it("clears when every configured host is idle", async () => {
  const { gate } = gateWith(
    () => json([]),
    [target("local", "Local", LOCAL), target("remote", "otomat-vps", REMOTE)],
  );
  await expect(gate.observe()).resolves.toEqual({ clear: true });
});

it("names the host that still has runs, and how many", async () => {
  const { gate } = gateWith(
    (url) => json(url.startsWith(REMOTE) ? busyRuns(2) : []),
    [target("local", "Local", LOCAL), target("remote", "otomat-vps", REMOTE)],
  );
  await expect(gate.observe()).resolves.toEqual({
    clear: false,
    reason: "otomat-vps still has 2 runs in flight.",
  });
});

it("blocks on a configured host it cannot reach, naming it", async () => {
  const { gate } = gateWith(
    () => json([]),
    [target("local", "Local", LOCAL), target("remote", "otomat-vps", null)],
  );
  await expect(gate.observe()).resolves.toEqual({
    clear: false,
    reason: "otomat-vps could not be reached, so its runs cannot be read.",
  });
});

it("reads an unanswerable run list as busy, never as idle", async () => {
  const { gate } = gateWith(refused, [target("local", "Local", LOCAL)]);
  await expect(gate.observe()).resolves.toEqual({
    clear: false,
    reason: "Local could not be reached, so its runs cannot be read.",
  });
});

it("holds each host and judges the count it answers with", async () => {
  const { gate, calls } = gateWith(
    () => json({ held: true, active_runs: 0 }),
    [target("local", "Local", LOCAL), target("remote", "otomat-vps", REMOTE)],
  );
  await expect(gate.arm()).resolves.toEqual({ clear: true });
  expect(calls).toEqual([
    { url: `${LOCAL}/api/settings/launch-hold`, held: true },
    { url: `${REMOTE}/api/settings/launch-hold`, held: true },
  ]);
});

it("blocks when the launch started while the operator was reading the notes", async () => {
  const { gate } = gateWith(
    () => json({ held: true, active_runs: 1 }),
    [target("local", "Local", LOCAL)],
  );
  await expect(gate.arm()).resolves.toEqual({
    clear: false,
    reason: "Local still has 1 run in flight.",
  });
});

it("blocks when a host will not take the hold", async () => {
  const { gate } = gateWith(refused, [target("local", "Local", LOCAL)]);
  await expect(gate.arm()).resolves.toEqual({
    clear: false,
    reason: "Local did not accept the update hold.",
  });
});

it("lifts the hold on every reachable host", async () => {
  const { gate, calls } = gateWith(
    () => json({ held: false, active_runs: 0 }),
    [target("local", "Local", LOCAL), target("remote", "otomat-vps", null)],
  );
  await gate.release();
  expect(calls).toEqual([{ url: `${LOCAL}/api/settings/launch-hold`, held: false }]);
});
