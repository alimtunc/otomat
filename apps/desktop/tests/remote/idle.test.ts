import { expect, it, vi } from "vitest";

import { remoteIsIdle } from "#main/remote/idle";

function runsResponse(payload: unknown): Response {
  return { ok: true, json: async () => payload } as Response;
}

function options(fetchImpl: typeof fetch, log: (message: string) => void = () => {}) {
  return { baseUrl: "http://127.0.0.1:45010", fetchImpl, log };
}

it("is busy while any run has a live or permission-blocked turn", async () => {
  for (const busy of ["queued", "preparing", "running", "awaiting_permission"]) {
    const fetchImpl = vi.fn(async () => runsResponse([{ status: "failed" }, { status: busy }]));
    expect(await remoteIsIdle(options(fetchImpl))).toBe(false);
  }
});

it("is idle when every run is resting, terminal, or selection-blocked", async () => {
  // awaiting_selection counting as idle is today's deliberate set; changing it is a behavior call.
  const statuses = ["review_ready", "failed", "merged", "awaiting_selection"];
  const fetchImpl = vi.fn(async () => runsResponse(statuses.map((status) => ({ status }))));
  expect(await remoteIsIdle(options(fetchImpl))).toBe(true);
});

it("ignores rows without a readable status", async () => {
  const fetchImpl = vi.fn(async () => runsResponse([null, "running", { status: 7 }, {}]));
  expect(await remoteIsIdle(options(fetchImpl))).toBe(true);
});

it("never reports idle on a refusal, an unexpected body, or an unreachable host", async () => {
  expect(await remoteIsIdle(options(vi.fn(async () => ({ ok: false }) as Response)))).toBe(false);
  expect(await remoteIsIdle(options(vi.fn(async () => runsResponse({}))))).toBe(false);

  const log = vi.fn();
  const unreachable = vi.fn(async () => {
    throw new Error("tunnel down");
  });
  expect(await remoteIsIdle(options(unreachable, log))).toBe(false);
  expect(log).toHaveBeenCalledWith("Remote idle check failed: Error: tunnel down");
});
