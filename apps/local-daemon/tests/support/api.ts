import type { RunRow } from "@otomat/db";
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
    startedAt: "2026-07-05T00:00:00.000Z",
    launchRun: async () => {
      throw new Error("launchRun stub not configured");
    },
    resumeRun: async () => {
      throw new Error("resumeRun stub not configured");
    },
    fixRun: async () => {
      throw new Error("fixRun stub not configured");
    },
    followUpRun: async () => {
      throw new Error("followUpRun stub not configured");
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
