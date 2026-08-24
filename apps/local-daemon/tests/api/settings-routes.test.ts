import type { AgentCapacity, ExecutionDefaults, LaunchHold } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request, stubSupervisor } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-settings-api-");
});

afterEach(() => {
  t.cleanup();
});

function put(path: string, body: unknown, capacity?: AgentCapacity) {
  const app = makeApiApp(
    t,
    capacity ? { supervisor: stubSupervisor({ setCapacity: () => capacity }) } : {},
  );
  return request(app, path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("serves the cap this daemon is applying, with what it is doing with it", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      capacity: () => ({
        max_concurrent_sessions: 4,
        active_sessions: 4,
        waiting_sessions: 1,
      }),
    }),
  });

  const capacity = await json<AgentCapacity>(await request(app, "/api/settings/capacity"));

  expect(capacity).toEqual({
    max_concurrent_sessions: 4,
    active_sessions: 4,
    waiting_sessions: 1,
  });
});

it("applies a new cap and answers with what the daemon now enforces", async () => {
  const res = await put(
    "/api/settings/capacity",
    { max_concurrent_sessions: 6 },
    { max_concurrent_sessions: 6, active_sessions: 4, waiting_sessions: 0 },
  );

  expect(res.status).toBe(200);
  expect(await json<AgentCapacity>(res)).toMatchObject({ max_concurrent_sessions: 6 });
});

it("arms the launch hold and answers with the runs still in flight", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({ setLaunchHold: (held) => ({ held, active_runs: 2 }) }),
  });

  const res = await request(app, "/api/settings/launch-hold", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ held: true }),
  });

  expect(res.status).toBe(200);
  expect(await json<LaunchHold>(res)).toEqual({ held: true, active_runs: 2 });
});

it("rejects a launch-hold request that does not say which way", async () => {
  const app = makeApiApp(t, { supervisor: stubSupervisor() });

  const res = await request(app, "/api/settings/launch-hold", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hold: true }),
  });

  expect(res.status).toBe(400);
});

it("rejects a cap that is not a positive integer before the daemon applies anything", async () => {
  for (const value of [0, -2, 1.5, "6", null]) {
    const res = await put("/api/settings/capacity", { max_concurrent_sessions: value });
    expect(res.status).toBe(400);
    expect(await json<{ error: string }>(res)).toMatchObject({ error: "invalid_request" });
  }
});

it("rejects an unknown settings key rather than silently ignoring it", async () => {
  const res = await put("/api/settings/capacity", { max_concurrent_sessions: 2, extra: true });
  expect(res.status).toBe(400);
});

it("answers with nothing selected until execution defaults are configured", async () => {
  const app = makeApiApp(t);

  const defaults = await json<ExecutionDefaults>(
    await request(app, "/api/settings/execution-defaults"),
  );

  expect(defaults).toEqual({ runtime: null, model: null, options: {} });
});

it("stores execution defaults and serves them back for every later launch", async () => {
  const saved = await put("/api/settings/execution-defaults", {
    runtime: "fake",
    model: "fake-thorough",
    options: { effort: "low" },
  });

  expect(saved.status).toBe(200);
  expect(await json<ExecutionDefaults>(saved)).toEqual({
    runtime: "fake",
    model: "fake-thorough",
    options: { effort: "low" },
  });
});

it("refuses a default the chosen runtime and model do not announce", async () => {
  const res = await put("/api/settings/execution-defaults", {
    runtime: "fake",
    model: "fake-fast",
    options: { effort: "high" },
  });

  expect(res.status).toBe(400);
  expect(await json<{ error: string }>(res)).toMatchObject({ error: "option_unsupported" });
});

it("refuses a model and options with no runtime to belong to", async () => {
  const res = await put("/api/settings/execution-defaults", {
    runtime: null,
    model: "fake-thorough",
    options: {},
  });

  expect(res.status).toBe(400);
});

it("selects no PR metadata generator until one is chosen, so generation follows the run", async () => {
  const app = makeApiApp(t, {});

  const generator = await json<ExecutionDefaults>(await request(app, "/api/settings/pr-generator"));

  expect(generator).toEqual({ runtime: null, model: null, options: {} });
});

it("stores the PR metadata generator apart from the execution defaults", async () => {
  const saved = await put("/api/settings/pr-generator", {
    runtime: "fake",
    model: "fake-thorough",
    options: { effort: "low" },
  });

  expect(saved.status).toBe(200);
  expect(await json<ExecutionDefaults>(saved)).toEqual({
    runtime: "fake",
    model: "fake-thorough",
    options: { effort: "low" },
  });

  const app = makeApiApp(t, {});
  expect(
    await json<ExecutionDefaults>(await request(app, "/api/settings/execution-defaults")),
  ).toEqual({ runtime: null, model: null, options: {} });
});

it("refuses a generator the chosen runtime and model do not announce", async () => {
  const res = await put("/api/settings/pr-generator", {
    runtime: "fake",
    model: "fake-fast",
    options: { effort: "high" },
  });

  expect(res.status).toBe(400);
  expect(await json<{ error: string }>(res)).toMatchObject({ error: "option_unsupported" });
});
