import { expect, it } from "vitest";

import { buildSupportBundle } from "#main/data-safety/support/bundle";

it("contains only versions, health, schema metadata and already-redacted logs", () => {
  const health = {
    status: "ok" as const,
    name: "otomat-local-daemon",
    version: "0.1.0",
    started_at: "2026-07-23T10:00:00.000Z",
    db_path: "/Users/private/Otomat/otomat.db",
  };
  const serialized = buildSupportBundle({
    versions: {
      desktop: "0.0.0",
      electron: "43.0.0",
      node: "24.0.0",
      platform: "darwin",
      arch: "arm64",
    },
    health,
    schema: { migration_count: 9, latest_migration_at: 123, page_count: 42, page_size: 4096 },
    logs: {
      desktop:
        'startup failed prompt={\n"messages":["private instructions","second private instruction"]\n}\nsafe desktop diagnostic',
      daemon:
        '{"authorization":"Bearer opaque-secret","user_prompt":[\n"third private instruction"\n]}',
    },
  });
  const bundle = JSON.parse(serialized) as Record<string, unknown>;

  expect(Object.keys(bundle).toSorted()).toEqual(["health", "logs", "schema", "versions"]);
  expect(serialized).not.toContain("private instructions");
  expect(serialized).not.toContain("lin_api_secretvalue");
  expect(serialized).not.toContain("opaque-secret");
  expect(serialized).not.toContain("/Users/private");
  expect(serialized).toContain("[REDACTED");
  expect(serialized).toContain("safe desktop diagnostic");
});

it("redacts CR-only prompt continuations", () => {
  const serialized = buildSupportBundle({
    versions: {
      desktop: "0.0.0",
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
    logs: {
      desktop: 'prompt="PRIVATE ONE\rPRIVATE TWO"\rsafe diagnostic',
      daemon: "prompt: {\rPRIVATE THREE\r}\rapi_key: { value: PRIVATE FOUR }",
    },
  });

  expect(serialized).not.toContain("PRIVATE");
  expect(serialized).toContain("safe diagnostic");
});
