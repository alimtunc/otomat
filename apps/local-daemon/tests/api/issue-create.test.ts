import type { IssueContract, RuntimeDescriptor } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RuntimeUnavailableError } from "#runtime";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-api-issues-");
});

afterEach(() => {
  t.cleanup();
  vi.unstubAllEnvs();
});

it("creates a local backlog issue without launching a run", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/issues", {
    project_id: "p1",
    title: "  Wire the CSV parser  ",
    body: "Nested quoting support",
  });
  expect(res.status).toBe(201);
  const issue = (await res.json()) as IssueContract;
  expect(issue).toMatchObject({
    project_id: "p1",
    title: "Wire the CSV parser",
    body: "Nested quoting support",
    status: "backlog",
    source: "local",
    source_external_id: null,
    synced_at: null,
  });

  const listed = (await (await request(app, "/api/issues")).json()) as IssueContract[];
  expect(listed.map((entry) => entry.id)).toContain(issue.id);
  const runs = (await (await request(app, `/api/runs?issueId=${issue.id}`)).json()) as unknown[];
  expect(runs).toEqual([]);
});

it("creates an issue without a body as null", async () => {
  const res = await post(makeApiApp(t), "/api/issues", { project_id: "p1", title: "No body" });
  expect(res.status).toBe(201);
  expect(((await res.json()) as IssueContract).body).toBeNull();
});

it("rejects an issue with a blank title or missing project", async () => {
  const app = makeApiApp(t);
  const blank = await post(app, "/api/issues", { project_id: "p1", title: "   " });
  expect(blank.status).toBe(400);
  expect(((await blank.json()) as { error: string }).error).toBe("invalid_request");

  const missing = await post(app, "/api/issues", { title: "No project" });
  expect(missing.status).toBe(400);
});

it("rejects an issue for an unknown project", async () => {
  const res = await post(makeApiApp(t), "/api/issues", { project_id: "ghost", title: "Nope" });
  expect(res.status).toBe(400);
  expect((await res.json()) as { error: string }).toEqual({ error: "project_not_found" });
});

it("maps RuntimeUnavailableError from launch to a 409 with the reason", async () => {
  const app = makeApiApp(t, {
    launchRun: async () => {
      throw new RuntimeUnavailableError("claude", "binary_not_found");
    },
  });
  const res = await post(app, "/api/runs", { prompt: "do it", runtime: "claude" });
  expect(res.status).toBe(409);
  expect((await res.json()) as unknown).toEqual({
    error: "runtime_unavailable",
    runtime: "claude",
    reason: "binary_not_found",
  });
});

it("serves the runtime catalog with probed availability and hides fake in production", async () => {
  const app = makeApiApp(t);
  const listed = (await (await request(app, "/api/runtimes")).json()) as RuntimeDescriptor[];
  // Vitest counts as a test env, so the fake is listed here.
  expect(listed.map((d) => d.id)).toEqual(["claude", "codex", "fake"]);
  for (const descriptor of listed) {
    expect(["available", "unavailable"]).toContain(descriptor.availability.status);
  }

  vi.stubEnv("VITEST", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OTOMAT_ENABLE_FAKE_RUNTIME", "");
  const prod = (await (await request(app, "/api/runtimes")).json()) as RuntimeDescriptor[];
  expect(prod.map((d) => d.id)).toEqual(["claude", "codex"]);
});
