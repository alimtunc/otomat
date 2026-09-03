import { workspaceCleanupRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

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

  routes.post("/:workspaceId/cleanup", validateJson(workspaceCleanupRequestSchema), (c) => {
    const workspaceId = c.req.param("workspaceId");
    const result = deps.supervisor.cleanupWorkspace(workspaceId, c.req.valid("json").force);
    if (result === null) {
      return c.json(
        { error: "workspace_not_found", message: `no workspace is recorded as ${workspaceId}` },
        404,
      );
    }
    return c.json(result);
  });

  return routes;
}
