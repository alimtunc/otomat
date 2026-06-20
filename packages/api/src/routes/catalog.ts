import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { readProjects, readRepositories } from "../reads.js";

/** Read-only workspace catalog: projects and repositories. */
export function createCatalogRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/projects", (c) => c.json(readProjects(deps.db)));

  routes.get("/repositories", (c) => c.json(readRepositories(deps.db, c.req.query("projectId"))));

  return routes;
}
