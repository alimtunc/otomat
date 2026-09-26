import { workspaceUpdateErrorSchema, type WorkspaceFreshness } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RunWorkspaceClosedError, WorkspaceUpdateRefusedError } from "#supervisor";

import { json, makeApiApp, post, request, stubSupervisor } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-workspace-freshness-api-");
  seedRepository(t.db);
  seedRun(t.db, {
    runId: "r1",
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
});

afterEach(() => {
  t.cleanup();
});

const CURRENT: WorkspaceFreshness = {
  state: "up_to_date",
  branch: null,
  base: { ref: "origin/main", sha: "abc", ahead: 1, behind: 0, strategies: [] },
  dirty: false,
};

it("serves the comparison, and names a closed workspace instead of comparing it", async () => {
  const workspaceFreshness = vi
    .fn()
    .mockResolvedValueOnce(CURRENT)
    .mockRejectedValueOnce(new RunWorkspaceClosedError("closed"));
  const app = makeApiApp(t, { supervisor: stubSupervisor({ workspaceFreshness }) });

  expect(await json(await request(app, "/api/runs/r1/workspace/freshness"))).toEqual(CURRENT);

  const closed = await request(app, "/api/runs/r1/workspace/freshness");
  expect(closed.status).toBe(409);
  expect(await json(closed)).toEqual({
    error: "workspace_closed",
    message: expect.stringContaining("no longer holds its issue's workspace"),
  });
});

it("carries a conflict's paths so the cockpit can explain what was aborted", async () => {
  const updateWorkspace = vi.fn(async () => {
    throw new WorkspaceUpdateRefusedError("update_conflict", "stopped on conflicts", {
      conflicts: ["shared.md"],
    });
  });
  const app = makeApiApp(t, { supervisor: stubSupervisor({ updateWorkspace }) });

  const refused = await post(app, "/api/runs/r1/workspace/update", {
    source: "branch",
    strategy: "rebase",
  });

  expect(refused.status).toBe(409);
  expect(workspaceUpdateErrorSchema.parse(await json(refused))).toEqual({
    error: "update_conflict",
    message: "stopped on conflicts",
    conflicts: ["shared.md"],
    remote: null,
  });
  expect(updateWorkspace).toHaveBeenCalledWith("r1", { source: "branch", strategy: "rebase" });
});

it("rejects a strategy the contract does not know before reaching the supervisor", async () => {
  const updateWorkspace = vi.fn();
  const app = makeApiApp(t, { supervisor: stubSupervisor({ updateWorkspace }) });

  const response = await post(app, "/api/runs/r1/workspace/update", {
    source: "base",
    strategy: "reset",
  });

  expect(response.status).toBe(400);
  expect(updateWorkspace).not.toHaveBeenCalled();
});
