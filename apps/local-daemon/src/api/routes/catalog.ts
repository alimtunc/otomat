import { Hono } from "hono";

import { listRuntimeDescriptors } from "#runtime";

import type { ApiDeps } from "../deps.js";
import { readProjects, readRepositories } from "../reads.js";

/** Read-only workspace catalog: projects, repositories, and the runtime registry. */
export function createCatalogRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/projects", (c) => c.json(readProjects(deps.db)));

  routes.get("/repositories", (c) => c.json(readRepositories(deps.db, c.req.query("projectId"))));

  routes.get("/runtimes", (c) => c.json(listRuntimeDescriptors()));

  return routes;
}
