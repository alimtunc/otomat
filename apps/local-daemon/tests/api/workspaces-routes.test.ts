import { insertProject } from "@otomat/db";
import type {
  WorkspaceCleanupResult,
  WorkspaceInventory,
  WorkspaceReconcileReport,
  WorkspaceSettings,
} from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, request, stubSupervisor } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-workspaces-api-");
});

afterEach(() => {
  t.cleanup();
});

const ENTRY = {
  id: "wt-1",
  repository_id: "repo-1",
  repository_name: "R",
  repository_path: "/tmp/repo",
  issue_id: "i1",
  issue_identifier: "OTO-1",
  issue_title: "I",
  run_id: "r1",
  branch: "otomat/run/r1",
  path: "/tmp/worktrees/r1",
  state: "cleanup_required",
  attachment: "record",
  blocker: null,
  reason: "Ready to delete.",
  registered: true,
  present: true,
  dirty: false,
  head_sha: "abc",
  last_activity_at: "2026-08-18 00:00:00",
  pull_request: { number: 42, url: "https://github.com/acme/app/pull/42", merged: true },
} as const;

const INVENTORY: WorkspaceInventory = {
  entries: [ENTRY],
  counts: { active: 0, cleanup_required: 1, stale: 0, missing: 0, unmanaged: 0 },
};

it("answers the inventory without touching git, and narrows it to one run or project", async () => {
  const scopes: unknown[] = [];
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      workspaces: (scope) => {
        scopes.push(scope);
        return INVENTORY;
      },
    }),
  });

  const all = await json<WorkspaceInventory>(await request(app, "/api/workspaces"));
  await request(app, "/api/workspaces?run_id=r1");
  await request(app, "/api/workspaces?project_id=p1");

  expect(all.counts.cleanup_required).toBe(1);
  expect(scopes).toEqual([{}, { runId: "r1" }, { projectId: "p1" }]);
});

it("reports what a reconciliation actually did", async () => {
  const report: WorkspaceReconcileReport = {
    pull_requests_refreshed: 2,
    pruned: 1,
    converged: 1,
    cleaned: 1,
    skipped: 0,
    failed: 0,
    inventory: INVENTORY,
  };
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({ reconcileWorkspaces: async () => report }),
  });

  const res = await request(app, "/api/workspaces/reconcile", { method: "POST" });

  expect(res.status).toBe(200);
  expect(await json<WorkspaceReconcileReport>(res)).toMatchObject({ cleaned: 1, pruned: 1 });
});

it("returns the daemon's refusal verbatim rather than a fake success", async () => {
  const skipped: WorkspaceCleanupResult = {
    outcome: "skipped",
    blocker: "worktree_dirty",
    message: "Uncommitted changes are still in this worktree.",
    entry: { ...ENTRY, blocker: "worktree_dirty" },
  };
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({ cleanupWorkspace: () => skipped }),
  });

  const res = await request(app, "/api/workspaces/wt-1/cleanup", { method: "POST" });

  expect(res.status).toBe(200);
  expect(await json<WorkspaceCleanupResult>(res)).toMatchObject({
    outcome: "skipped",
    blocker: "worktree_dirty",
  });
});

it("404s a cleanup of a workspace no record holds", async () => {
  const app = makeApiApp(t, { supervisor: stubSupervisor({ cleanupWorkspace: () => null }) });

  const res = await request(app, "/api/workspaces/wt-gone/cleanup", { method: "POST" });

  expect(res.status).toBe(404);
  expect(await json<{ error: string }>(res)).toMatchObject({ error: "workspace_not_found" });
});

it("serves a project's auto-delete setting on by default and persists a change", async () => {
  const app = makeApiApp(t);

  const initial = await json<WorkspaceSettings>(
    await request(app, "/api/settings/workspaces?project_id=p1"),
  );
  const updated = await request(app, "/api/settings/workspaces?project_id=p1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auto_delete_after_merge: false }),
  });

  expect(initial).toEqual({ auto_delete_after_merge: true });
  expect(await json<WorkspaceSettings>(updated)).toEqual({ auto_delete_after_merge: false });
  expect(
    await json<WorkspaceSettings>(await request(app, "/api/settings/workspaces?project_id=p1")),
  ).toEqual({ auto_delete_after_merge: false });
});

it("keeps each project's auto-delete setting to itself", async () => {
  insertProject(t.db, { id: "p2", name: "Second", root_path: "/tmp/otomat-p2" });
  const app = makeApiApp(t);

  await request(app, "/api/settings/workspaces?project_id=p1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auto_delete_after_merge: false }),
  });

  expect(
    await json<WorkspaceSettings>(await request(app, "/api/settings/workspaces?project_id=p2")),
  ).toEqual({ auto_delete_after_merge: true });
});

it("refuses an auto-delete setting no project stands for", async () => {
  const app = makeApiApp(t);

  const res = await request(app, "/api/settings/workspaces?project_id=p-gone");

  expect(res.status).toBe(404);
  expect(await json<{ error: string }>(res)).toMatchObject({ error: "project_not_found" });
});
