import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createClient,
  insertIssue,
  insertProject,
  runMigrations,
  type Db,
  type RunRow,
} from "@otomat/db";
import type { HealthResponse, RunContract, RunDetail, StartRunRequest } from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createApiApp } from "#api/app";
import type { ApiDeps } from "#api/deps";
import { appendEvents } from "#events";
import type { RuntimeEvent } from "#runtime";

import { stubReviewService } from "../support/review.js";
import { seedRun } from "../support/seed.js";

const PROJECT_ID = "project-1";
const ISSUE_ID = "issue-1";

let dbPath = "";
let db: Db;
let close: () => void;

function logEvent(runId: string, n: number): RuntimeEvent {
  return {
    id: `${runId}:${n}`,
    run_id: runId,
    step_run_id: null,
    agent_session_id: null,
    type: "runtime.log",
    source: "otomat",
    occurred_at: new Date(Date.parse("2026-01-01T00:00:00.000Z") + n * 1000).toISOString(),
    payload: { fidelity: "raw_log", adapter: "fake", stream: "stdout", text: `line ${n}` },
    raw_ref: null,
  };
}

function seedTerminalRun(database: Db, runId: string): void {
  seedRun(database, {
    runId,
    issueId: ISSUE_ID,
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  appendEvents(database, runId, [logEvent(runId, 0), logEvent(runId, 1), logEvent(runId, 2)], 0);
}

function runRow(id: string): RunRow {
  return {
    id,
    issue_id: ISSUE_ID,
    repository_id: null,
    worktree_id: null,
    agent_id: null,
    status: "running",
    branch: "b",
    plan_json: { version: 1, steps: [] },
    started_at: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function request(
  app: Hono,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  return app.request(path, { ...init, headers: { Host: "127.0.0.1", ...init.headers } });
}

interface AppOverrides {
  launchRun?: ApiDeps["launchRun"];
  resumeRun?: ApiDeps["resumeRun"];
  fixRun?: ApiDeps["fixRun"];
  abortRun?: ApiDeps["abortRun"];
  review?: ApiDeps["review"];
}

function makeApp(overrides: AppOverrides = {}) {
  return createApiApp({
    db,
    name: "test-daemon",
    version: "9.9.9",
    startedAt: "2026-06-20T00:00:00.000Z",
    dbPath,
    launchRun: overrides.launchRun ?? (async () => runRow("run-default")),
    resumeRun: overrides.resumeRun ?? (async () => runRow("run-default")),
    fixRun: overrides.fixRun ?? (async () => runRow("run-default")),
    abortRun: overrides.abortRun ?? (async () => {}),
    review: overrides.review ?? stubReviewService(),
  });
}

beforeEach(() => {
  dbPath = join(tmpdir(), `otomat-api-${randomUUID()}.db`);
  runMigrations(dbPath);
  const client = createClient(dbPath);
  db = client.db;
  close = () => client.sqlite.close();
  insertProject(db, { id: PROJECT_ID, name: "Local", root_path: "/tmp/repo" });
  insertIssue(db, { id: ISSUE_ID, project_id: PROJECT_ID, title: "First issue", status: "ready" });
});

afterEach(() => {
  close();
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${dbPath}${suffix}`, { force: true });
});

it("serves daemon health", async () => {
  const res = await request(makeApp(), "/api/health");
  expect(res.status).toBe(200);
  const body = (await res.json()) as HealthResponse;
  expect(body).toMatchObject({ status: "ok", name: "test-daemon", version: "9.9.9" });
});

it("lists projects and issues from SQLite", async () => {
  const app = makeApp();
  expect((await (await request(app, "/api/projects")).json()) as unknown).toHaveLength(1);
  const issues = (await (await request(app, "/api/issues")).json()) as { id: string }[];
  expect(issues.map((i) => i.id)).toEqual([ISSUE_ID]);
});

it("returns 404 for an unknown run", async () => {
  const res = await request(makeApp(), "/api/runs/does-not-exist");
  expect(res.status).toBe(404);
});

it("composes run detail with steps and sessions (events come over SSE, not detail)", async () => {
  const runId = "run-detail";
  seedTerminalRun(db, runId);
  const res = await request(makeApp(), `/api/runs/${runId}`);
  expect(res.status).toBe(200);
  const detail = (await res.json()) as RunDetail;
  expect(detail.run.id).toBe(runId);
  expect(detail.steps).toHaveLength(1);
  expect(detail.sessions).toHaveLength(1);
  expect(detail).not.toHaveProperty("events");
});

it("rejects a start-run request with neither issue_id nor prompt", async () => {
  const res = await request(makeApp(), "/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

it("delegates start-run to the injected launchRun dep", async () => {
  let received: StartRunRequest | null = null;
  const app = makeApp({
    launchRun: async (request) => {
      received = request;
      return runRow("run-x");
    },
  });
  const res = await request(app, "/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "do it" }),
  });
  expect(res.status).toBe(201);
  expect(received).toEqual({ prompt: "do it" });
  expect(((await res.json()) as RunContract).id).toBe("run-x");
});

it("delegates resume to the supervisor for a known run", async () => {
  const runId = "run-detail";
  seedTerminalRun(db, runId);
  let resumed = "";
  const app = makeApp({
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
  const res = await request(makeApp(), "/api/runs/nope/resume", { method: "POST" });
  expect(res.status).toBe(404);
});

it("delegates abort to the supervisor and returns the run detail", async () => {
  const runId = "run-detail";
  seedTerminalRun(db, runId);
  let aborted = "";
  const app = makeApp({ abortRun: async (id) => void (aborted = id) });
  const res = await request(app, `/api/runs/${runId}/abort`, { method: "POST" });
  expect(res.status).toBe(200);
  expect(aborted).toBe(runId);
  expect(((await res.json()) as RunDetail).run.id).toBe(runId);
});

it("rejects a request with no Host header", async () => {
  const res = await makeApp().request("/api/health");
  expect(res.status).toBe(403);
});

it("rejects a request whose Host header is not a loopback host", async () => {
  const res = await request(makeApp(), "/api/health", {
    headers: { Host: "evil.example.com" },
  });
  expect(res.status).toBe(403);
  expect((await res.json()) as { error: string }).toEqual({ error: "forbidden_host" });
});

it("accepts a loopback Host with a port", async () => {
  const res = await request(makeApp(), "/api/health", {
    headers: { Host: "127.0.0.1:4319" },
  });
  expect(res.status).toBe(200);
});

it("echoes CORS for a loopback origin but not a foreign one", async () => {
  const app = makeApp();
  const ok = await request(app, "/api/health", { headers: { Origin: "http://localhost:5173" } });
  expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");

  const denied = await request(app, "/api/health", {
    headers: { Origin: "https://evil.example.com" },
  });
  expect(denied.headers.get("access-control-allow-origin")).not.toBe("https://evil.example.com");
});

it("streams persisted events over SSE and ends on a terminal run", async () => {
  const runId = "run-sse";
  seedTerminalRun(db, runId);
  const res = await request(makeApp(), `/api/runs/${runId}/events`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const text = await res.text();
  expect(text).toContain("event: event");
  expect(text).toContain('"seq":0');
  expect(text).toContain("event: end");
});
