import type { RunContributionRow, RunRow } from "@otomat/db";
import type { Hono } from "hono";

import { createApiApp } from "#api/app";
import type { ApiDeps } from "#api/deps";

import type { TestDb } from "./db.js";
import { stubGitHubService } from "./github.js";
import { stubLinearService } from "./linear.js";
import { stubReviewService } from "./review.js";

/** `app.request` with the loopback Host header the api's host-guard requires. */
export async function request(
  app: Hono,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  return app.request(path, { ...init, headers: { Host: "127.0.0.1", ...init.headers } });
}

export function post(app: Hono, path: string, body: unknown): Promise<Response> {
  return request(app, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function patch(app: Hono, path: string, body: unknown): Promise<Response> {
  return request(app, path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function del(app: Hono, path: string): Promise<Response> {
  return request(app, path, { method: "DELETE" });
}

export async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function runRow(id: string, overrides: Partial<RunRow> = {}): RunRow {
  return {
    id,
    issue_id: "i1",
    repository_id: null,
    worktree_id: null,
    agent_id: null,
    status: "running",
    branch: "b",
    plan_json: { version: 1, steps: [] },
    started_at: null,
    completed_at: null,
    abandoned_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function contributionRow(
  runId: string,
  overrides: Partial<RunContributionRow> = {},
): RunContributionRow {
  return {
    id: "contribution-1",
    run_id: runId,
    step_run_id: `${runId}-step`,
    seq: 0,
    body: "keep going",
    status: "queued",
    agent_session_id: null,
    delivered_at: null,
    settled_at: null,
    attempts: 0,
    error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** ApiDeps app over the shared TestDb; un-overridden run commands throw, never fake-succeed. */
export function makeApiApp(
  t: Pick<TestDb, "db" | "dbPath">,
  overrides: Partial<ApiDeps> = {},
): Hono {
  return createApiApp({
    db: t.db,
    dbPath: t.dbPath,
    name: "test-daemon",
    version: "9.9.9",
    build: "abc1234",
    startedAt: "2026-07-05T00:00:00.000Z",
    schemaMetadata: () => ({
      migration_count: 10,
      latest_migration_at: 1_784_742_886_678,
      page_count: 1,
      page_size: 4096,
    }),
    launchRun: async () => {
      throw new Error("launchRun stub not configured");
    },
    runWait: () => null,
    agentCapacity: () => ({
      max_concurrent_sessions: 4,
      active_sessions: 0,
      waiting_sessions: 0,
    }),
    setAgentCapacity: () => {
      throw new Error("setAgentCapacity stub not configured");
    },
    resumeRun: async () => {
      throw new Error("resumeRun stub not configured");
    },
    runResumePlan: () => ({ mode: "unavailable", reason: "resume plan stub not configured" }),
    abandonWorkspace: () => {
      throw new Error("abandonWorkspace stub not configured");
    },
    workspaceClosure: () => null,
    appendRunStep: async () => {
      throw new Error("appendRunStep stub not configured");
    },
    contributeToRun: async () => {
      throw new Error("contributeToRun stub not configured");
    },
    retryRunContribution: async () => {
      throw new Error("retryRunContribution stub not configured");
    },
    cancelRunContribution: () => {
      throw new Error("cancelRunContribution stub not configured");
    },
    deliverRunContributions: async () => {
      throw new Error("deliverRunContributions stub not configured");
    },
    selectCompeteWinner: async () => {
      throw new Error("selectCompeteWinner stub not configured");
    },
    abortRun: async () => {},
    github: stubGitHubService(),
    linear: stubLinearService(),
    review: stubReviewService(),
    ...overrides,
  });
}
