import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { readInbox } from "../inbox.js";

export function createInboxRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readInbox(deps.db)));

  return routes;
}
