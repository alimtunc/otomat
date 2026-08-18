import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { readReviewQueue } from "../review-queue.js";

/** Mounted at `/api/reviews`: the one list the Reviews view and the sidebar count both read. */
export function createReviewQueueRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => {
    const projectId = c.req.query("projectId");
    if (projectId === undefined) return c.json({ error: "project_required" }, 400);
    return c.json(readReviewQueue(deps.db, projectId));
  });

  return routes;
}
