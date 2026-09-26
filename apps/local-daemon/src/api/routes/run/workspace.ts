import { updateWorkspaceRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { RunWorkspaceClosedError, WorkspaceUpdateRefusedError } from "#supervisor";

const WORKSPACE_CLOSED = {
  error: "workspace_closed",
  message:
    "This run no longer holds its issue's workspace, so there is nothing to compare or update.",
} as const;

/** Mounted at `/api/runs`. */
export function createRunWorkspaceRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/workspace/freshness", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      return c.json(await deps.supervisor.workspaceFreshness(run.id));
    } catch (error) {
      if (error instanceof RunWorkspaceClosedError) {
        return c.json(WORKSPACE_CLOSED, 409);
      }
      console.error(`[otomat] comparing run ${run.id} with its remote failed`, error);
      return c.json({ error: "workspace_freshness_failed" }, 500);
    }
  });

  routes.post(
    "/:id/workspace/update",
    validateJson(updateWorkspaceRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        return c.json(await deps.supervisor.updateWorkspace(run.id, c.req.valid("json")));
      } catch (error) {
        if (error instanceof WorkspaceUpdateRefusedError) {
          return c.json(
            {
              error: error.code,
              message: error.message,
              conflicts: error.conflicts,
              remote: error.remote,
            },
            409,
          );
        }
        if (error instanceof RunWorkspaceClosedError) {
          return c.json(WORKSPACE_CLOSED, 409);
        }
        console.error(`[otomat] updating the workspace of run ${run.id} failed`, error);
        return c.json({ error: "workspace_update_failed" }, 500);
      }
    },
  );

  return routes;
}
