import { schema, type Db } from "@otomat/db";
import type {
  HealthResponse,
  RunContributionContract,
  RunDetail,
  RunLaunchResponse,
  StartRunRequest,
} from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { RuntimeEvent } from "#runtime";
import {
  LaunchRefusedError,
  RunContributionNotRetriableError,
  RunWorkspaceClosedError,
  type AppendStepInput,
} from "#supervisor";

import { contributionRow, makeApiApp, post, request, runRow } from "../support/api.js";
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
  expect(body).toMatchObject({
    status: "ok",
    name: "test-daemon",
    version: "9.9.9",
    build: "abc1234",
    schema: {
      migration_count: 10,
      latest_migration_at: 1_784_742_886_678,
    },
  });
});

it("reads current schema metadata for every health response", async () => {
  let pageCount = 1;
  const app = makeApiApp(t, {
    schemaMetadata: () => ({
      migration_count: 10,
      latest_migration_at: 1_784_742_886_678,
      page_count: pageCount,
      page_size: 4096,
    }),
  });

  expect(
    ((await (await request(app, "/api/health")).json()) as HealthResponse).schema.page_count,
  ).toBe(1);
  pageCount = 2;
  expect(
    ((await (await request(app, "/api/health")).json()) as HealthResponse).schema.page_count,
  ).toBe(2);
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
  expect(detail.wait).toBeNull();
  expect(detail).not.toHaveProperty("events");
});

it("tells the cockpit why a queued run is not moving", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const app = makeApiApp(t, {
    runWait: () => ({ kind: "workflow_dependency", blocked_by: ["Implement"] }),
  });

  const detail = (await (await request(app, `/api/runs/${runId}`)).json()) as RunDetail;

  expect(detail.wait).toEqual({ kind: "workflow_dependency", blocked_by: ["Implement"] });
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
  expect((await res.json()) as RunLaunchResponse).toMatchObject({
    run: { id: "run-x" },
    wait: null,
  });
});

it("answers a saturated launch with the run and the place it is queued at", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => runRow("run-queued", { status: "queued" }),
    runWait: () => ({
      kind: "concurrency_limit",
      position: 2,
      active_sessions: 4,
      max_concurrent_sessions: 4,
    }),
  });
  const res = await post(app, "/api/runs", { prompt: "the fifth one" });

  expect(res.status).toBe(201);
  expect((await res.json()) as RunLaunchResponse).toMatchObject({
    run: { id: "run-queued", status: "queued" },
    wait: { kind: "concurrency_limit", position: 2, max_concurrent_sessions: 4 },
  });
});

it("returns a conflict with the refusal code when the project has no usable repository", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => {
      throw new LaunchRefusedError("repository_required", "project p1 has no repository to run in");
    },
  });
  const res = await post(app, "/api/runs", { prompt: "goal" });

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "repository_required",
    message: "project p1 has no repository to run in",
    run_id: null,
  });
});

it("sends a second launch on an unmerged issue back to the run that holds its workspace", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => {
      throw new LaunchRefusedError("issue_workspace_open", "issue i1 already works in b", {
        runId: "run-holding",
      });
    },
  });
  const res = await post(app, "/api/runs", { issue_id: "i1" });

  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "issue_workspace_open",
    message: "issue i1 already works in b",
    run_id: "run-holding",
  });
});

it("returns a bad request when the requested base branch does not exist", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => {
      throw new LaunchRefusedError("base_branch_not_found", 'branch "ghost" does not exist in /r');
    },
  });
  const res = await post(app, "/api/runs", { prompt: "goal", base_branch: "ghost" });

  expect(res.status).toBe(400);
  expect((await res.json()) as { error: string }).toMatchObject({ error: "base_branch_not_found" });
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

it("appends a step with the agent the caller chose, never an inherited one", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  let received: AppendStepInput | null = null;
  const app = makeApiApp(t, {
    appendRunStep: async (_id, input) => {
      received = input;
      return runRow(runId);
    },
  });

  const res = await post(app, `/api/runs/${runId}/steps`, {
    name: "Address review",
    prompt: "rename beta",
    profile_id: "p-reviewer",
    depends_on: [],
  });

  expect(res.status).toBe(201);
  expect(received).toEqual({
    name: "Address review",
    prompt: "rename beta",
    selector: { kind: "profile", profileId: "p-reviewer" },
    dependsOn: [],
    origin: "user",
  });
});

it("rejects an appended step with no agent, and maps a closed workspace to 409", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);

  const noAgent = await post(makeApiApp(t), `/api/runs/${runId}/steps`, {
    name: "Address review",
    prompt: "rename beta",
  });
  expect(noAgent.status).toBe(400);

  const closed = makeApiApp(t, {
    appendRunStep: async () => {
      throw new RunWorkspaceClosedError("merged");
    },
  });
  const res = await post(closed, `/api/runs/${runId}/steps`, {
    name: "Address review",
    prompt: "rename beta",
    runtime: "fake",
  });
  expect(res.status).toBe(409);
  expect(((await res.json()) as { error: string }).error).toBe("workspace_closed");
});

it("returns 404 appending a step to an unknown run", async () => {
  const res = await post(makeApiApp(t), "/api/runs/nope/steps", {
    name: "Address review",
    prompt: "rename beta",
    runtime: "fake",
  });
  expect(res.status).toBe(404);
});

it("delegates a contribution to the supervisor with the trimmed body", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  let received: { id: string; body: string } | null = null;
  const app = makeApiApp(t, {
    contributeToRun: async (id, body) => {
      received = { id, body };
      return contributionRow(id, { body });
    },
  });
  const res = await post(app, `/api/runs/${runId}/contributions`, { body: "  keep going  " });
  expect(res.status).toBe(201);
  expect(received).toEqual({ id: runId, body: "keep going" });
  const contribution = (await res.json()) as RunContributionContract;
  expect(contribution.status).toBe("queued");
  expect(contribution.delivered_at).toBeNull();
});

it("rejects a contribution with a blank body", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const res = await post(makeApiApp(t), `/api/runs/${runId}/contributions`, { body: "   " });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
});

it("returns 404 contributing to an unknown run", async () => {
  const res = await post(makeApiApp(t), "/api/runs/nope/contributions", { body: "p" });
  expect(res.status).toBe(404);
});

it("maps a non-retriable contribution to 409 rather than replaying a delivered message", async () => {
  const runId = "run-detail";
  seedTerminalRun(t.db, runId);
  const app = makeApiApp(t, {
    retryRunContribution: async () => {
      throw new RunContributionNotRetriableError("already reached the agent");
    },
  });
  const res = await post(app, `/api/runs/${runId}/contributions/c1/retry`, {});
  expect(res.status).toBe(409);
  expect(((await res.json()) as { error: string }).error).toBe("run_contribution_not_retriable");
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
