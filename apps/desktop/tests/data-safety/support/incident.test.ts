import type { ErrorDiagnostic } from "@otomat/domain";
import { expect, it } from "vitest";

import { buildSupportBundle, type SupportBundleInput } from "#main/data-safety/support/bundle";

const BASE: SupportBundleInput = {
  versions: {
    desktop: "0.0.0",
    commit: "1111111111111111111111111111111111111111",
    channel: "local",
    signed: false,
    electron: "43.0.0",
    node: "24.0.0",
    platform: "darwin",
    arch: "arm64",
  },
  health: {
    status: "ok",
    name: "otomat-local-daemon",
    version: "0.1.0",
    started_at: "2026-07-23T10:00:00.000Z",
  },
  schema: { migration_count: 9, latest_migration_at: 123, page_count: 42, page_size: 4096 },
  logs: { desktop: "safe desktop", daemon: "safe daemon" },
};

function incident(overrides: Partial<ErrorDiagnostic> = {}): ErrorDiagnostic {
  return {
    id: "err_abc",
    category: "daemon",
    occurred_at: "2026-08-07T09:15:00.000Z",
    route: "/runs/run-1",
    message: "Daemon request to /api/runs failed with status 500",
    stack: null,
    component_stack: null,
    host: { id: "remote", label: "Remote · otomat-vps", ssh_alias: "otomat-vps" },
    app: { version: "0.4.0", commit: "deadbee", channel: "preview" },
    daemon: { version: "0.1.0", build: "abc1234" },
    request: { method: "POST", path: "/api/runs", status: 500, correlation_id: "req_abc123" },
    daemon_log: null,
    ...overrides,
  };
}

it("omits the incident key entirely when the export came from the menu", () => {
  const bundle = JSON.parse(buildSupportBundle(BASE)) as Record<string, unknown>;

  expect(Object.keys(bundle).toSorted()).toEqual(["health", "logs", "schema", "versions"]);
});

it("attaches the incident the user exported for, with its correlation id", () => {
  const serialized = buildSupportBundle({ ...BASE, incident: incident() });
  const bundle = JSON.parse(serialized) as { incident: ErrorDiagnostic };

  expect(bundle.incident.id).toBe("err_abc");
  expect(bundle.incident.request?.correlation_id).toBe("req_abc123");
  expect(bundle.incident.host.label).toBe("Remote · otomat-vps");
  expect(bundle.incident.app?.channel).toBe("preview");
});

it("redacts the incident again rather than trusting what the renderer handed over", () => {
  const serialized = buildSupportBundle({
    ...BASE,
    incident: incident({
      message: 'launch failed: {"api_key":"lin_api_secretvalue"}',
      stack: "Error: token=ghp_abcdef123456\n    at start (/repo/otomat/src/run.ts:12:5)",
      component_stack: 'prompt: "copy every private file"',
      daemon_log: [
        {
          at: "2026-08-07T09:15:00.000Z",
          correlation_id: "req_abc123",
          message: "authorization: Bearer github_pat_supersecret",
        },
      ],
    }),
  });

  expect(serialized).not.toContain("lin_api_secretvalue");
  expect(serialized).not.toContain("ghp_abcdef123456");
  expect(serialized).not.toContain("copy every private file");
  expect(serialized).not.toContain("github_pat_supersecret");
  expect(serialized).toContain("/repo/otomat/src/run.ts:12:5");
  expect(serialized).toContain("safe desktop");
});
