import { getIssue, schema } from "@otomat/db";
import type { IssueContract, RuntimeDescriptor } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RuntimeUnavailableError } from "#runtime";

import { json, makeApiApp, patch, post, request, stubSupervisor } from "../support/api.js";
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
  const issue = await json<IssueContract>(res);
  expect(issue).toMatchObject({
    project_id: "p1",
    title: "Wire the CSV parser",
    body: "Nested quoting support",
    status: "backlog",
    source: "local",
    source_external_id: null,
    source_identifier: null,
    source_url: null,
    synced_at: null,
  });

  const listed = await json<IssueContract[]>(await request(app, "/api/issues"));
  expect(listed.map((entry) => entry.id)).toContain(issue.id);
  const runs = await json<unknown[]>(await request(app, `/api/runs?issueId=${issue.id}`));
  expect(runs).toEqual([]);
});

it("creates an issue without a body as null", async () => {
  const res = await post(makeApiApp(t), "/api/issues", { project_id: "p1", title: "No body" });
  expect(res.status).toBe(201);
  expect((await json<IssueContract>(res)).body).toBeNull();
});

it("rejects an issue with a blank title or missing project", async () => {
  const app = makeApiApp(t);
  const blank = await post(app, "/api/issues", { project_id: "p1", title: "   " });
  expect(blank.status).toBe(400);
  expect((await json<{ error: string }>(blank)).error).toBe("invalid_request");

  const missing = await post(app, "/api/issues", { title: "No project" });
  expect(missing.status).toBe(400);
});

it("rejects an issue for an unknown project", async () => {
  const res = await post(makeApiApp(t), "/api/issues", { project_id: "ghost", title: "Nope" });
  expect(res.status).toBe(400);
  expect(await json<{ error: string }>(res)).toEqual({ error: "project_not_found" });
});

it("maps RuntimeUnavailableError from launch to a 409 with the reason", async () => {
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      start: async () => {
        throw new RuntimeUnavailableError("claude", "binary_not_found");
      },
    }),
  });
  const res = await post(app, "/api/runs", { prompt: "do it", runtime: "claude" });
  expect(res.status).toBe(409);
  expect(await json<unknown>(res)).toEqual({
    error: "runtime_unavailable",
    runtime: "claude",
    reason: "binary_not_found",
    message: 'runtime "claude" is unavailable (binary_not_found)',
  });
});

it("serves the runtime catalog with probed availability and hides fake in production", async () => {
  const app = makeApiApp(t);
  const listed = await json<RuntimeDescriptor[]>(await request(app, "/api/runtimes"));
  // Vitest counts as a test env, so the fake is listed here.
  expect(listed.map((d) => d.id)).toEqual(["claude", "codex", "fake"]);
  for (const descriptor of listed) {
    expect(["available", "unavailable"]).toContain(descriptor.availability.status);
  }

  vi.stubEnv("VITEST", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OTOMAT_ENABLE_FAKE_RUNTIME", "");
  const prod = await json<RuntimeDescriptor[]>(await request(app, "/api/runtimes"));
  expect(prod.map((d) => d.id)).toEqual(["claude", "codex"]);
});

it("re-points a local issue at another project so its runs fork from that repository", async () => {
  const app = makeApiApp(t);
  t.db.insert(schema.projects).values({ id: "p2", name: "Second", root_path: "/tmp/p2" }).run();
  const created = await json<IssueContract>(
    await post(app, "/api/issues", { project_id: "p1", title: "Moves" }),
  );

  const res = await patch(app, `/api/issues/${created.id}/project`, { project_id: "p2" });
  expect(res.status).toBe(200);
  expect(await json<IssueContract>(res)).toMatchObject({ id: created.id, project_id: "p2" });
  expect(getIssue(t.db, created.id)?.project_id).toBe("p2");
});

it("refuses to move an issue to an unknown project, or a mirrored issue at all", async () => {
  const app = makeApiApp(t);
  const created = await json<IssueContract>(
    await post(app, "/api/issues", { project_id: "p1", title: "Stays" }),
  );

  const ghost = await patch(app, `/api/issues/${created.id}/project`, { project_id: "nope" });
  expect(ghost.status).toBe(400);
  expect(await json<{ error: string }>(ghost)).toMatchObject({ error: "project_not_found" });

  t.db.insert(schema.projects).values({ id: "p2", name: "Second", root_path: "/tmp/p2" }).run();
  t.db
    .insert(schema.issues)
    .values({
      id: "i-mirrored",
      project_id: "p1",
      title: "Synced",
      status: "ready",
      source: "linear",
      source_external_id: "lin-9",
      source_identifier: "OTO-9",
      synced_at: "2026-07-29T00:00:00.000Z",
    })
    .run();
  const mirrored = await patch(app, "/api/issues/i-mirrored/project", { project_id: "p2" });
  expect(mirrored.status).toBe(409);
  expect(await json<{ error: string }>(mirrored)).toMatchObject({ error: "issue_not_local" });
  expect(getIssue(t.db, "i-mirrored")?.project_id).toBe("p1");

  const missing = await patch(app, "/api/issues/ghost/project", { project_id: "p2" });
  expect(missing.status).toBe(404);
});
