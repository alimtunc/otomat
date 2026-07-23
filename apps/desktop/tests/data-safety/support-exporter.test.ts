import { expect, it, vi } from "vitest";

import type { SupportBundleHealth } from "#main/data-safety/support-bundle";
import { exportSupportBundle } from "#main/data-safety/support-exporter";

const HEALTH = {
  status: "ok",
  name: "otomat-local-daemon",
  version: "0.1.0",
  started_at: "2026-07-23T10:00:00.000Z",
  db_path: "/Users/private/Otomat/otomat.db",
  schema: {
    migration_count: 10,
    latest_migration_at: 1_784_742_886_678,
    page_count: 42,
    page_size: 4096,
  },
} as const;

function exporter(
  overrides: Partial<Parameters<typeof exportSupportBundle>[0]> = {},
): Parameters<typeof exportSupportBundle>[0] {
  return {
    versions: {
      desktop: "0.0.0",
      electron: "43.0.0",
      node: "24.0.0",
      platform: "darwin",
      arch: "arm64",
    },
    daemonUrl: () => "http://127.0.0.1:4319",
    readLogs: () => ({ desktop: "safe desktop", daemon: "safe daemon" }),
    chooseDestination: async () => "/tmp/support.json",
    write: vi.fn(),
    fetch: vi.fn(async () => Response.json(HEALTH)),
    ...overrides,
  };
}

it("writes nothing when the user cancels the save dialog", async () => {
  const write = vi.fn();
  const options = exporter({ chooseDestination: async () => null, write });

  await expect(exportSupportBundle(options)).resolves.toEqual({ status: "canceled" });
  expect(write).not.toHaveBeenCalled();
});

it("separates safe health from schema metadata and omits the database path", async () => {
  const write = vi.fn();
  const options = exporter({ write });

  await expect(exportSupportBundle(options)).resolves.toEqual({
    status: "written",
    path: "/tmp/support.json",
  });
  const serialized = String(write.mock.calls[0]?.[1]);
  const bundle = JSON.parse(serialized) as Record<string, unknown>;
  expect(Object.keys(bundle).toSorted()).toEqual(["health", "logs", "schema", "versions"]);
  expect(serialized).not.toContain("/Users/private");
  expect(bundle.schema).toEqual(HEALTH.schema);
});

it("writes available logs with unavailable health when the daemon health request times out", async () => {
  const write = vi.fn();
  const fetch = vi.fn(
    async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  );

  await expect(
    exportSupportBundle(exporter({ fetch, healthTimeoutMs: 1, write })),
  ).resolves.toEqual({
    status: "written",
    path: "/tmp/support.json",
  });
  const bundle = JSON.parse(String(write.mock.calls[0]?.[1])) as {
    health: SupportBundleHealth;
    logs: { desktop: string; daemon: string };
  };
  expect(bundle.health).toEqual({
    status: "unavailable",
    detail: "The daemon health response was unavailable or invalid.",
  });
  expect(bundle.logs).toEqual({ desktop: "safe desktop", daemon: "safe daemon" });
});
