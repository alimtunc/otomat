import { syncPullRequestInboxRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

export function createReviewInboxRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => {
    const projectId = c.req.query("projectId");
    if (projectId === undefined || projectId === "")
      return c.json({ error: "project_required" }, 400);
    return c.json(deps.github.pullRequestInbox(projectId));
  });

  /** A refused pass answers 200 with the inbox it had; the failure rides `sync.last_error`. */
  routes.post("/sync", validateJson(syncPullRequestInboxRequestSchema), async (c) =>
    c.json(await deps.github.syncPullRequestInbox(c.req.valid("json").project_id)),
  );

  return routes;
}
