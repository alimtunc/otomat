import { Hono } from "hono";

import { listRuntimeDescriptors } from "#runtime";

import type { ApiDeps } from "../deps.js";
import { readProjects } from "../reads.js";

/** Read-only workspace catalog: projects and the runtime registry; repositories live under `/api/repositories`. */
export function createCatalogRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/projects", (c) => c.json(readProjects(deps.db)));

  routes.get("/runtimes", (c) => c.json(listRuntimeDescriptors()));

  return routes;
}
