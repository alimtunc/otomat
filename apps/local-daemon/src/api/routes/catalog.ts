import { Hono } from "hono";

import {
  describeRuntimeModelCatalog,
  isKnownRuntimeId,
  listRuntimeDescriptors,
  UnknownRuntimeError,
} from "#runtime";

import type { ApiDeps } from "../deps.js";
import { readProjects } from "../reads.js";

/** Read-only workspace catalog: projects, the runtime registry, and each runtime's model catalog. */
export function createCatalogRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/projects", (c) => c.json(readProjects(deps.db)));

  routes.get("/runtimes", (c) => c.json(listRuntimeDescriptors()));

  // Probes the installed provider binary, so it stays out of the runtime list every surface polls.
  routes.get("/runtimes/:id/models", (c) => {
    const id = c.req.param("id");
    // Membership in the descriptor list keeps the gate identical to `/runtimes`: the fake runtime stays hidden in production.
    if (!isKnownRuntimeId(id) || !listRuntimeDescriptors().some((entry) => entry.id === id)) {
      return c.json(
        { error: "runtime_unknown", message: new UnknownRuntimeError(id).message },
        404,
      );
    }
    return c.json(describeRuntimeModelCatalog(id));
  });

  return routes;
}
