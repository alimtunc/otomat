import type { Db } from "@otomat/db";
import type { HealthResponse, RunContract, RunDetail, StartRunRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { appendEvents } from "#events";
import type { RuntimeEvent } from "#runtime";

import { makeApiApp, post, request, runRow } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { makeEvent } from "../support/run-event-fixtures.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-api-");
});

afterEach(() => {
  t.cleanup();
});

function logEvent(runId: string, n: number): RuntimeEvent {
  return makeEvent(runId, n, {
    occurred_at: new Date(Date.parse("2026-01-01T00:00:00.000Z") + n * 1000).toISOString(),
    payload: { fidelity: "raw_log", adapter: "fake", stream: "stdout", text: `line ${n}` },
  });
}

function seedTerminalRun(database: Db, runId: string): void {
  seedRun(database, {
    runId,
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  appendEvents(database, runId, [logEvent(runId, 0), logEvent(runId, 1), logEvent(runId, 2)], 0);
}

it("serves daemon health", async () => {
  const res = await request(makeApiApp(t), "/api/health");
  expect(res.status).toBe(200);
  const body = (await res.json()) as HealthResponse;
  expect(body).toMatchObject({ status: "ok", name: "test-daemon", version: "9.9.9" });
});

it("lists projects and issues from SQLite", async () => {
  const app = makeApiApp(t);
  expect((await (await request(app, "/api/projects")).json()) as unknown).toHaveLength(1);
  const issues = (await (await request(app, "/api/issues")).json()) as { id: string }[];
  expect(issues.map((i) => i.id)).toEqual(["i1"]);
});

it("returns 404 for an unknown run", async () => {
  const res = await request(makeApiApp(t), "/api/runs/does-not-exist");
  expect(res.status).toBe(404);
});

it("composes run detail with steps and sessions (events come over SSE, not detail)", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const res = await request(makeApiApp(t), `/api/runs/${runId}`);
  expect(res.status).toBe(200);
  const detail = (await res.json()) as RunDetail;
  expect(detail.run.id).toBe(runId);
  expect(detail.steps).toHaveLength(1);
  expect(detail.sessions).toHaveLength(1);
  expect(detail).not.toHaveProperty("events");
});

it("rejects a start-run request with neither issue_id nor prompt", async () => {
  const res = await post(makeApiApp(t), "/api/runs", {});
  expect(res.status).toBe(400);
});

it("delegates start-run to the injected launchRun dep", async () => {
  let received: StartRunRequest | null = null;
  const app = makeApiApp(t, {
    launchRun: async (req) => {
      received = req;
      return runRow("run-x");
    },
  });
  const res = await post(app, "/api/runs", { prompt: "do it" });
  expect(res.status).toBe(201);
  expect(received).toEqual({ prompt: "do it" });
  expect(((await res.json()) as RunContract).id).toBe("run-x");
});

it("delegates resume to the supervisor for a known run", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  let resumed = "";
  const app = makeApiApp(t, {
    resumeRun: async (id) => {
      resumed = id;
      return runRow(id);
    },
  });
  const res = await request(app, `/api/runs/${runId}/resume`, { method: "POST" });
  expect(res.status).toBe(200);
  expect(resumed).toBe(runId);
});

it("returns 404 resuming an unknown run", async () => {
  const res = await request(makeApiApp(t), "/api/runs/nope/resume", { method: "POST" });
  expect(res.status).toBe(404);
});

it("delegates abort to the supervisor and returns the run detail", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  let aborted = "";
  const app = makeApiApp(t, { abortRun: async (id) => void (aborted = id) });
  const res = await request(app, `/api/runs/${runId}/abort`, { method: "POST" });
  expect(res.status).toBe(200);
  expect(aborted).toBe(runId);
  expect(((await res.json()) as RunDetail).run.id).toBe(runId);
});

it("rejects a request with no Host header", async () => {
  const res = await makeApiApp(t).request("/api/health");
  expect(res.status).toBe(403);
});

it("rejects a request whose Host header is not a loopback host", async () => {
  const res = await request(makeApiApp(t), "/api/health", {
    headers: { Host: "evil.example.com" },
  });
  expect(res.status).toBe(403);
  expect((await res.json()) as { error: string }).toEqual({ error: "forbidden_host" });
});

it("accepts a loopback Host with a port", async () => {
  const res = await request(makeApiApp(t), "/api/health", {
    headers: { Host: "127.0.0.1:4319" },
  });
  expect(res.status).toBe(200);
});

it("echoes CORS for a loopback origin but not a foreign one", async () => {
  const app = makeApiApp(t);
  const ok = await request(app, "/api/health", { headers: { Origin: "http://localhost:5173" } });
  expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

  const denied = await request(app, "/api/health", {
    headers: { Origin: "https://evil.example.com" },
  });
  expect(denied.headers.get("access-control-allow-origin")).not.toBe("https://evil.example.com");
});

it("streams persisted events over SSE and ends on a terminal run", async () => {
  const runId = "run-sse";
  seedTerminalRun(t.db, runId);
  const res = await request(makeApiApp(t), `/api/runs/${runId}/events`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const text = await res.text();
  expect(text).toContain("event: event");
  expect(text).toContain('"seq":0');
  expect(text).toContain("event: end");
});
