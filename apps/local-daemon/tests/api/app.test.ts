import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createClient,
  insertAgentSession,
  insertIssue,
  insertProject,
  insertRun,
  insertStepRun,
  runMigrations,
  type Db,
} from "@otomat/db";
import type { HealthResponse, RunContract, RunDetail, StartRunRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createApiApp } from "#api/app";
import type { ApiDeps } from "#api/deps";
import { appendEvents } from "#events";
import type { RuntimeEvent } from "#runtime";

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
  insertRun(database, {
    id: runId,
    issue_id: ISSUE_ID,
    status: "completed",
    branch: `otomat/run/${runId}`,
    plan_json: {
      version: 1,
      steps: [{ id: "step-1", name: "Agent turn", agent: "fake", prompt: "p", depends_on: [] }],
    },
  });
  insertStepRun(database, {
    id: "step-1",
    run_id: runId,
    idx: 0,
    name: "Agent turn",
    status: "succeeded",
  });
  insertAgentSession(database, { id: "session-1", step_run_id: "step-1", status: "terminated" });
  appendEvents(database, runId, [logEvent(runId, 0), logEvent(runId, 1), logEvent(runId, 2)], 0);
}

function makeApp(launchRun: ApiDeps["launchRun"] = async () => ({}) as RunContract) {
  return createApiApp({
    db,
    name: "test-daemon",
    version: "9.9.9",
    startedAt: "2026-06-20T00:00:00.000Z",
    dbPath,
    launchRun,
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
  const res = await makeApp().request("/api/health");
  expect(res.status).toBe(200);
  const body = (await res.json()) as HealthResponse;
  expect(body).toMatchObject({ status: "ok", name: "test-daemon", version: "9.9.9" });
});

it("lists projects and issues from SQLite", async () => {
  const app = makeApp();
  expect((await (await app.request("/api/projects")).json()) as unknown).toHaveLength(1);
  const issues = (await (await app.request("/api/issues")).json()) as { id: string }[];
  expect(issues.map((i) => i.id)).toEqual([ISSUE_ID]);
});

it("returns 404 for an unknown run", async () => {
  const res = await makeApp().request("/api/runs/does-not-exist");
  expect(res.status).toBe(404);
});

it("composes run detail with steps, sessions and events", async () => {
  const runId = "run-detail";
  seedTerminalRun(db, runId);
  const res = await makeApp().request(`/api/runs/${runId}`);
  expect(res.status).toBe(200);
  const detail = (await res.json()) as RunDetail;
  expect(detail.run.id).toBe(runId);
  expect(detail.steps).toHaveLength(1);
  expect(detail.sessions).toHaveLength(1);
  expect(detail.events.map((e) => e.seq)).toEqual([0, 1, 2]);
});

it("rejects a start-run request with neither issue_id nor prompt", async () => {
  const res = await makeApp().request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

it("delegates start-run to the injected launcher", async () => {
  let received: StartRunRequest | null = null;
  const run = {
    id: "run-x",
    issue_id: ISSUE_ID,
    status: "running",
    branch: "b",
    plan_json: { version: 1, steps: [] },
  } satisfies RunContract;
  const app = makeApp(async (request) => {
    received = request;
    return run;
  });
  const res = await app.request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "do it" }),
  });
  expect(res.status).toBe(201);
  expect(received).toEqual({ prompt: "do it" });
  expect(((await res.json()) as RunContract).id).toBe("run-x");
});

it("streams persisted events over SSE and ends on a terminal run", async () => {
  const runId = "run-sse";
  seedTerminalRun(db, runId);
  const res = await makeApp().request(`/api/runs/${runId}/events`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const text = await res.text();
  expect(text).toContain("event: event");
  expect(text).toContain('"seq":0');
  expect(text).toContain("event: end");
});
