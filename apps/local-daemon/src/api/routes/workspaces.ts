import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";

export function createWorkspaceRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => {
    return c.json(
      deps.supervisor.workspaces({
        runId: c.req.query("run_id"),
        projectId: c.req.query("project_id"),
      }),
    );
  });

  routes.post("/reconcile", async (c) => c.json(await deps.supervisor.reconcileWorkspaces()));

  routes.post("/:worktreeId/cleanup", (c) => {
    const worktreeId = c.req.param("worktreeId");
    const result = deps.supervisor.cleanupWorkspace(worktreeId);
    if (result === null) {
      return c.json(
        { error: "workspace_not_found", message: `no workspace is recorded as ${worktreeId}` },
        404,
      );
    }
    return c.json(result);
  });

  return routes;
}
