import type { RuntimeModelCatalog } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ModelSelectionRefusedError } from "#runtime";

import { json, makeApiApp, post, request, stubSupervisor } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-runtime-models-api-");
});

afterEach(() => {
  t.cleanup();
});

it("serves a runtime's model catalog with the provenance of every entry", async () => {
  const app = makeApiApp(t);

  const catalog = await json<RuntimeModelCatalog>(await request(app, "/api/runtimes/fake/models"));

  expect(catalog.runtime).toBe("fake");
  expect(catalog.allows_custom).toBe(false);
  expect(catalog.discovery.status).toBe("unsupported");
  expect(catalog.discovery.detail).toBeTypeOf("string");
  expect(catalog.models).toEqual([
    expect.objectContaining({ id: "fake-fast", source: "static" }),
    expect.objectContaining({ id: "fake-thorough", source: "static" }),
  ]);
});

it("404s on a runtime the daemon does not know", async () => {
  const app = makeApiApp(t);
  const res = await request(app, "/api/runtimes/made-up/models");
  expect(res.status).toBe(404);
  const body = await json<{ error: string; message: string }>(res);
  expect(body.error).toBe("runtime_unknown");
  expect(body.message).toContain("made-up");
});

it("refuses a launch whose model the runtime does not list", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      start: async () => {
        throw new ModelSelectionRefusedError(
          "model_unknown",
          'runtime "fake" does not list "gpt-5"',
        );
      },
    }),
  });

  const res = await post(app, "/api/runs", {
    prompt: "do it",
    runtime: "fake",
    model: { kind: "model", id: "gpt-5" },
  });

  expect(res.status).toBe(400);
  const body = await json<{ error: string; message: string }>(res);
  expect(body.error).toBe("model_unknown");
  expect(body.message).toContain("gpt-5");
});

it("rejects a model identifier that could be read as another CLI flag", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/runs", {
    prompt: "do it",
    runtime: "fake",
    model: { kind: "model", id: "--dangerously-skip-permissions" },
  });
  expect(res.status).toBe(400);
});
