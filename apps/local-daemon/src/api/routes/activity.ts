import { Hono } from "hono";

import { streamActivity } from "../activity-stream.js";
import { readActivity } from "../activity.js";
import type { ApiDeps } from "../deps.js";

/** Mounted at `/api/activity`: the cross-project snapshot and its live stream. */
export function createActivityRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readActivity(deps.db)));
  routes.get("/stream", (c) => streamActivity(c, deps.db));

  return routes;
}
