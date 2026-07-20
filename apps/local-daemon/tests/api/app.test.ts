import { schema, type Db } from "@otomat/db";
import type { HealthResponse, RunContract, RunDetail, StartRunRequest } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { RuntimeEvent } from "#runtime";
import { CompeteRepositoryRequiredError, RunNotResumableError } from "#supervisor";

import { makeApiApp, post, request, runRow } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { appendEvents } from "../support/ledger.js";
import { stubReviewService } from "../support/review.js";
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
  expect(detail.worktree_path).toBeNull();
  expect(detail).not.toHaveProperty("events");
});

it("exposes the run's worktree path on its detail", async () => {
  const runId = "run-worktree";
  seedTerminalRun(t.db, runId);
  const repositoryId = seedRepository(t.db);
  t.db
    .insert(schema.worktrees)
    .values({
      id: "wt1",
      repository_id: repositoryId,
      path: "/tmp/otomat/wt1",
      branch: `otomat/run/${runId}`,
      owner_token: runId,
    })
    .run();
  t.db.update(schema.runs).set({ worktree_id: "wt1" }).where(eq(schema.runs.id, runId)).run();
  const res = await request(makeApiApp(t), `/api/runs/${runId}`);
  const detail = (await res.json()) as RunDetail;
  expect(detail.worktree_path).toBe("/tmp/otomat/wt1");
});

it("rejects a start-run request with neither issue_id nor prompt", async () => {
  const res = await post(makeApiApp(t), "/api/runs", {});
  expect(res.status).toBe(400);
});

it("rejects a cyclic run plan with 400 before the launch dep ever runs", async () => {
  let launched = 0;
  const app = makeApiApp(t, {
    launchRun: async () => {
      launched += 1;
      return runRow("run-x");
    },
  });
  const res = await post(app, "/api/runs", {
    prompt: "goal",
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "A", agent: null, prompt: "pa", depends_on: ["b"] },
        { id: "b", name: "B", agent: null, prompt: "pb", depends_on: ["a"] },
      ],
    },
  });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
  expect(launched).toBe(0);
});

it("rejects duplicate step ids and unknown dependencies with 400", async () => {
  const duplicate = await post(makeApiApp(t), "/api/runs", {
    prompt: "goal",
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "A", agent: null, prompt: "pa", depends_on: [] },
        { id: "a", name: "A2", agent: null, prompt: "pa2", depends_on: [] },
      ],
    },
  });
  expect(duplicate.status).toBe(400);

  const unknownDep = await post(makeApiApp(t), "/api/runs", {
    prompt: "goal",
    plan: {
      version: 1,
      steps: [{ id: "a", name: "A", agent: null, prompt: "pa", depends_on: ["ghost"] }],
    },
  });
  expect(unknownDep.status).toBe(400);
});

it("delegates a valid multi-step plan to launchRun untouched", async () => {
  let received: StartRunRequest | null = null;
  const app = makeApiApp(t, {
    launchRun: async (req) => {
      received = req;
      return runRow("run-plan");
    },
  });
  const plan = {
    version: 1,
    steps: [
      { id: "plan", name: "Plan", agent: null, prompt: "plan it", depends_on: [] },
      { id: "build", name: "Build", agent: "fake", prompt: "build it", depends_on: ["plan"] },
    ],
  };
  const res = await post(app, "/api/runs", { prompt: "goal", plan });
  expect(res.status).toBe(201);
  expect(received).toEqual({ prompt: "goal", plan });
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

it("returns a conflict when compete cannot obtain isolated repository worktrees", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => {
      throw new CompeteRepositoryRequiredError("p1");
    },
  });
  const res = await post(app, "/api/runs", { prompt: "goal" });

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "compete_repository_required" });
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

it("delegates a follow-up to the supervisor with the trimmed prompt", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  let received: { id: string; prompt: string } | null = null;
  const app = makeApiApp(t, {
    followUpRun: async (id, prompt) => {
      received = { id, prompt };
      return runRow(id, { status: "running" });
    },
  });
  const res = await post(app, `/api/runs/${runId}/follow-up`, { prompt: "  keep going  " });
  expect(res.status).toBe(200);
  expect(received).toEqual({ id: runId, prompt: "keep going" });
  expect(((await res.json()) as RunContract).status).toBe("running");
});

it("rejects a follow-up with a blank prompt", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const res = await post(makeApiApp(t), `/api/runs/${runId}/follow-up`, { prompt: "   " });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
});

it("returns 404 following up an unknown run", async () => {
  const res = await post(makeApiApp(t), "/api/runs/nope/follow-up", { prompt: "p" });
  expect(res.status).toBe(404);
});

it("maps RunNotResumableError to 409 run_not_resumable on follow-up", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const app = makeApiApp(t, {
    followUpRun: async () => {
      throw new RunNotResumableError("nope");
    },
  });
  const res = await post(app, `/api/runs/${runId}/follow-up`, { prompt: "p" });
  expect(res.status).toBe(409);
  expect(((await res.json()) as { error: string }).error).toBe("run_not_resumable");
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

it("serves isolated candidate diff evidence and delegates explicit winner selection", async () => {
  const runId = "compete-run";
  t.db
    .insert(schema.runs)
    .values({
      id: runId,
      issue_id: "i1",
      status: "awaiting_selection",
      branch: "otomat/run/compete",
      plan_json: {
        version: 1,
        steps: [
          {
            id: "group-1",
            name: "Approach",
            depends_on: [],
            compete: [
              { id: "candidate-1", name: "One", agent: "fake", prompt: "one" },
              { id: "candidate-2", name: "Two", agent: "fake", prompt: "two" },
            ],
          },
        ],
      },
    })
    .run();
  t.db
    .insert(schema.competeGroups)
    .values({
      id: "group-1",
      run_id: runId,
      idx: 0,
      name: "Approach",
      status: "awaiting_selection",
    })
    .run();
  t.db
    .insert(schema.stepRuns)
    .values([
      {
        id: "candidate-1",
        run_id: runId,
        idx: 0,
        name: "One",
        status: "succeeded",
        compete_group_id: "group-1",
      },
      {
        id: "candidate-2",
        run_id: runId,
        idx: 1,
        name: "Two",
        status: "succeeded",
        compete_group_id: "group-1",
      },
    ])
    .run();
  let diffOwner: string | undefined;
  let selected: { runId: string; groupId: string; stepRunId: string } | null = null;
  const app = makeApiApp(t, {
    review: {
      ...stubReviewService(),
      getWorktreeDiff: (_run, owner) => {
        diffOwner = owner;
        return { computedAt: "2026-07-05T00:00:00.000Z", diff: null };
      },
    },
    selectCompeteWinner: async (selectedRunId, groupId, stepRunId) => {
      selected = { runId: selectedRunId, groupId, stepRunId };
    },
  });

  const diff = await request(
    app,
    `/api/runs/${runId}/compete-groups/group-1/candidates/candidate-1/diff`,
  );
  const winner = await post(app, `/api/runs/${runId}/compete-groups/group-1/winner`, {
    step_run_id: "candidate-1",
  });

  expect(diff.status).toBe(200);
  expect(diffOwner).toBe("candidate-1");
  expect(winner.status).toBe(200);
  expect(selected).toEqual({ runId, groupId: "group-1", stepRunId: "candidate-1" });
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
