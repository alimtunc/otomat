import type { RunContributionRow, RunInteractionRow, RunRow } from "@otomat/db";
import type { Hono } from "hono";

import { createApiApp } from "#api/app";
import type { ApiDeps } from "#api/deps";
import type { Supervisor } from "#supervisor";

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
  // SAFETY: routes answer their declared contract; each test's expectations check the fields it uses.
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

export function runRowWithStep(id: string, stepRunId: string): RunRow {
  return runRow(id, {
    plan_json: {
      version: 1,
      steps: [
        {
          id: stepRunId,
          name: "Appended step",
          agent: "fake",
          prompt: "",
          depends_on: [],
          config: {
            runtime: "fake",
            profile_id: null,
            profile_name: null,
            options: {},
            model: null,
            guidance: null,
            skills: [],
            sources: null,
            config_hash: `config-${stepRunId}`,
          },
        },
      ],
    },
  });
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
    target_agent_session_id: `${runId}-session`,
    target_config_json: null,
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

export function interactionRow(
  runId: string,
  overrides: Partial<RunInteractionRow> = {},
): RunInteractionRow {
  return {
    id: "interaction-1",
    run_id: runId,
    step_run_id: `${runId}-step`,
    agent_session_id: `${runId}-session`,
    provider_request_id: "req-1",
    kind: "permission",
    state: "pending",
    prompt: "Run Write: notes.md",
    tool: "Write",
    options_json: [],
    answer_json: null,
    canceled_reason: null,
    requested_at: "2026-01-01T00:00:00.000Z",
    settled_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Un-overridden commands throw, never fake-succeed. */
export function stubSupervisor(overrides: Partial<Supervisor> = {}): Supervisor {
  return {
    start: async () => {
      throw new Error("start stub not configured");
    },
    waitFor: () => null,
    scheduleProviderResume: () => {
      throw new Error("scheduleProviderResume stub not configured");
    },
    resumeDueProviderWaits: async () => {
      throw new Error("resumeDueProviderWaits stub not configured");
    },
    capacity: () => ({
      max_concurrent_sessions: 4,
      active_sessions: 0,
      waiting_sessions: 0,
    }),
    setCapacity: () => {
      throw new Error("setCapacity stub not configured");
    },
    setLaunchHold: () => {
      throw new Error("setLaunchHold stub not configured");
    },
    setNextTurnModel: () => {
      throw new Error("setNextTurnModel stub not configured");
    },
    stopStep: async () => {
      throw new Error("stopStep stub not configured");
    },
    resume: async () => {
      throw new Error("resume stub not configured");
    },
    resumePlan: () => ({ mode: "unavailable", reason: "resume plan stub not configured" }),
    abandon: () => {
      throw new Error("abandon stub not configured");
    },
    workspaceClosure: () => null,
    workspaces: () => ({
      entries: [],
      counts: { active: 0, cleanup_required: 0, stale: 0, missing: 0, unmanaged: 0 },
    }),
    reconcileWorkspaces: async () => {
      throw new Error("reconcileWorkspaces stub not configured");
    },
    cleanupWorkspace: () => null,
    appendStep: async () => {
      throw new Error("appendStep stub not configured");
    },
    contribute: async () => {
      throw new Error("contribute stub not configured");
    },
    retryContribution: async () => {
      throw new Error("retryContribution stub not configured");
    },
    cancelContribution: () => {
      throw new Error("cancelContribution stub not configured");
    },
    deliverContributions: async () => {
      throw new Error("deliverContributions stub not configured");
    },
    answerInteraction: async () => {
      throw new Error("answerInteraction stub not configured");
    },
    selectWinner: async () => {
      throw new Error("selectWinner stub not configured");
    },
    abort: async () => {},
    reconcile: () => ({ reconciled: [] }),
    settle: async () => {},
    shutdown: async () => {},
    ...overrides,
  };
}

/** ApiDeps app over the shared TestDb; see {@link stubSupervisor} for the run-command defaults. */
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
    supervisor: stubSupervisor(),
    github: stubGitHubService(),
    linear: stubLinearService(),
    review: stubReviewService(),
    ...overrides,
  });
}
