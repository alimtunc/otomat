import { describe, expect, it, vi } from "vitest";

import { waitForHealth } from "#shared/health";

function okBody() {
  return {
    status: "ok",
    name: "otomat-local-daemon",
    version: "0.1.0",
    started_at: "2026-07-19T00:00:00.000Z",
    db_path: "/db/otomat.db",
  };
}

const noSleep = async (): Promise<void> => {};

describe("waitForHealth", () => {
  it("resolves on the first healthy, schema-valid response", async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify(okBody()), { status: 200 }));
    await expect(
      waitForHealth({ url: "http://x/api/health", fetch: doFetch, sleep: noSleep }),
    ).resolves.toBeUndefined();
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const doFetch = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("ECONNREFUSED");
      return new Response(JSON.stringify(okBody()), { status: 200 });
    });
    await expect(
      waitForHealth({ url: "http://x/api/health", fetch: doFetch, sleep: noSleep }),
    ).resolves.toBeUndefined();
    expect(doFetch).toHaveBeenCalledTimes(3);
  });

  it("times out (against a virtual clock) with the last error as cause", async () => {
    let clock = 0;
    const doFetch = vi.fn(async () => new Response("nope", { status: 503 }));
    await expect(
      waitForHealth({
        url: "http://x/api/health",
        fetch: doFetch,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
        timeoutMs: 1000,
        intervalMs: 200,
      }),
    ).rejects.toThrow(/timed out/);
    expect(doFetch).toHaveBeenCalled();
  });

  it("aborts immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const doFetch = vi.fn();
    await expect(
      waitForHealth({ url: "http://x/api/health", fetch: doFetch, signal: controller.signal }),
    ).rejects.toThrow(/exited before/);
    expect(doFetch).not.toHaveBeenCalled();
  });
});
