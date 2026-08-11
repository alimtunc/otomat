import type { AgentCapacity } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-settings-api-");
});

afterEach(() => {
  t.cleanup();
});

function put(path: string, body: unknown, capacity?: AgentCapacity) {
  const app = makeApiApp(t, capacity ? { setAgentCapacity: () => capacity } : {});
  return request(app, path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("serves the cap this daemon is applying, with what it is doing with it", async () => {
  const app = makeApiApp(t, {
    agentCapacity: () => ({
      max_concurrent_sessions: 4,
      active_sessions: 4,
      waiting_sessions: 1,
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
