import { Hono } from "hono";

import { checkProjectHealth } from "#health";

import type { ApiDeps } from "../deps.js";

/** A read: it answers what this host would refuse a launch on, and changes nothing to find out. */
export function createProjectHealthRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/:id/health", async (c) => {
    const report = await checkProjectHealth(
      {
        db: deps.db,
        repositories: deps.repositories,
        github: deps.github,
        linear: deps.linear,
        daemon: { name: deps.name, version: deps.version, build: deps.build },
      },
      c.req.param("id"),
    );
    if (report === null) return c.json({ error: "project_not_found" }, 404);
    return c.json(report);
  });

  return routes;
}
