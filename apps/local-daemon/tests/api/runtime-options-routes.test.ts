import { providerOptionSetSchema, type ProviderOptionSet } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-runtime-options-api-");
});

afterEach(() => {
  t.cleanup();
});

it("serves an honest, contract-shaped option set when nothing is tunable yet", async () => {
  const app = makeApiApp(t);

  const res = await request(app, "/api/runtimes/fake/options");
  const set = await json<ProviderOptionSet>(res);

  expect(providerOptionSetSchema.parse(set)).toEqual(set);
  expect(set.runtime).toBe("fake");
  expect(set.model).toBeNull();
  expect(set.detection.status).toBe("unsupported");
  expect(set.options).toEqual([]);
});

it("scopes the option set to the requested model, whose levels it publishes", async () => {
  const app = makeApiApp(t);

  const set = await json<ProviderOptionSet>(
    await request(app, "/api/runtimes/fake/options?model=fake-fast"),
  );

  expect(set.model).toBe("fake-fast");
  const effort = set.options.find((option) => option.key === "effort");
  expect(effort?.choices.map((choice) => choice.value)).toEqual(["low", "medium"]);
});

it("404s on a runtime the daemon does not know", async () => {
  const app = makeApiApp(t);

  const res = await request(app, "/api/runtimes/made-up/options");

  expect(res.status).toBe(404);
  const body = await json<{ error: string; message: string }>(res);
  expect(body.error).toBe("runtime_unknown");
});

it("refuses a model identifier that could be read as another CLI flag", async () => {
  const app = makeApiApp(t);

  const res = await request(app, "/api/runtimes/fake/options?model=--dangerous");

  expect(res.status).toBe(400);
  const body = await json<{ error: string }>(res);
  expect(body.error).toBe("model_unknown");
});
