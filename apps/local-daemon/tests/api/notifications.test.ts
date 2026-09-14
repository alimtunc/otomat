import {
  insertPullRequest,
  recordRunInteraction,
  schema,
  updatePullRequest,
  updateAgentSessionStatus,
  writeGitHubViewer,
} from "@otomat/db";
import { inboxSnapshotSchema, notificationSnapshotSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { makeApiApp, request } from "#test-support/api";
import { seedRepository, setupTestDb, type TestDb } from "#test-support/db";
import { seedRun } from "#test-support/seed";

let t: TestDb;
beforeEach(() => {
  t = setupTestDb("otomat-notification-");
});
afterEach(() => {
  vi.useRealTimers();
  t.cleanup();
});

async function read() {
  const response = await request(makeApiApp(t), "/api/activity/notifications");
  expect(response.status).toBe(200);
  return notificationSnapshotSchema.parse(await response.json()).notifications;
}

it("returns distinct durable requests and only allowlisted fields, leaving Inbox untouched", async () => {
  const run = seedRun(t.db, {
    runId: "run",
    runStatus: "awaiting_permission",
    stepStatus: "awaiting_permission",
    sessionStatus: "active",
  });
  for (const kind of ["permission", "text", "choice", "questionnaire"] as const) {
    recordRunInteraction(t.db, {
      id: kind,
      run_id: run.runId,
      step_run_id: run.stepRunId,
      agent_session_id: run.agentSessionId,
      provider_request_id: kind,
      kind,
      prompt: "SECRET PROMPT",
      tool: "/private/path",
      reason: "SECRET CODE",
      questions_json: [],
      requested_at: "2026-09-10T10:00:00.000Z",
    });
  }
  const before = inboxSnapshotSchema.parse(
    await (await request(makeApiApp(t), "/api/inbox")).json(),
  );
  const notices = await read();
  expect(notices).toHaveLength(4);
  expect(notices.map((n) => n.id)).toEqual(
    expect.arrayContaining([
      "interaction:permission",
      "interaction:text",
      "interaction:choice",
      "interaction:questionnaire",
    ]),
  );
  expect(notices.find((n) => n.interaction_id === "text")).toMatchObject({
    category: "question",
    project_id: "p1",
    target: { kind: "run", run_id: "run" },
    step_run_id: run.stepRunId,
  });
  const serialized = JSON.stringify(notices);
  expect(serialized).not.toMatch(/SECRET|private|prompt|reason|tool|questions_json/);
  expect(await read()).toEqual(notices);
  const after = inboxSnapshotSchema.parse(
    await (await request(makeApiApp(t), "/api/inbox")).json(),
  );
  expect(after.entries).toEqual(before.entries);
});

it.each(["review_ready", "failed", "awaiting_human", "waiting_for_provider", "completed"] as const)(
  "announces %s from canonical state and ignores reconciliation replay",
  async (status) => {
    seedRun(t.db, {
      runId: "run",
      runStatus: status,
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    const first = await read();
    expect(first).toHaveLength(1);
    t.db
      .insert(schema.runtimeEvents)
      .values({
        id: "replayed-settle",
        run_id: "run",
        seq: 1,
        type: "run.lifecycle",
        source: "otomat",
        occurred_at: "2026-09-10T10:00:00.000Z",
        payload: { phase: "settled", run_status: status },
      })
      .run();
    expect(await read()).toEqual(first);
  },
);

it("keeps the PR notification stable across refresh timestamps", async () => {
  seedRepository(t.db);
  writeGitHubViewer(t.db, { login: "operator", teams: [] });
  insertPullRequest(t.db, {
    id: "pr",
    repository_id: "repo-1",
    number: 7,
    url: "https://github.com/acme/repo/pull/7",
    status: "open",
    author_login: "someone",
    review_decision: "review_required",
    requested_reviewers: [{ kind: "user", handle: "operator" }],
    title: "secret title",
    provider_updated_at: "2026-09-10T10:00:00.000Z",
  });
  const first = await read();
  expect(first[0]).toMatchObject({
    category: "review",
    target: { kind: "pull_request", pull_request_id: "pr" },
  });
  updatePullRequest(t.db, "pr", { synced_at: "2026-09-10T11:00:00.000Z" });
  expect(await read()).toEqual(first);
});

it("includes every completed run beyond the Activity panel's display limit", async () => {
  for (let index = 0; index < 10; index++) {
    seedRun(t.db, {
      runId: `run-${index}`,
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
  }
  expect(await read()).toHaveLength(10);
});

it("distinguishes interrupted turns when a resumed session has no terminal marker", async () => {
  const run = seedRun(t.db, {
    runId: "run",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-10T10:00:00.000Z"));
  updateAgentSessionStatus(t.db, run.agentSessionId, "active");
  updateAgentSessionStatus(t.db, run.agentSessionId, "awaiting_input");
  const first = await read();
  vi.setSystemTime(new Date("2026-09-10T10:01:00.000Z"));
  updateAgentSessionStatus(t.db, run.agentSessionId, "active");
  updateAgentSessionStatus(t.db, run.agentSessionId, "awaiting_input");
  const second = await read();
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(1);
  expect(second[0].id).not.toBe(first[0].id);
  expect(await read()).toEqual(second);
});

it("keeps a publication failure stable while its run starts another turn", async () => {
  const run = seedRun(t.db, {
    runId: "run",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  insertPullRequest(t.db, {
    id: "pr",
    issue_id: "i1",
    run_id: "run",
    publication_status: "failed",
    failed_phase: "pushing",
    error_code: "github_push_failed",
    title: "Work",
  });
  const first = await read();
  expect(first).toHaveLength(1);
  expect(first[0].target.kind).toBe("run_pull_request");
  updateAgentSessionStatus(t.db, run.agentSessionId, "active");
  expect(await read()).toEqual(first);
});
