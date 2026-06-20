import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { readIssue, readIssues } from "../reads.js";

/** Mounted at `/api/issues`. */
export function createIssueRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readIssues(deps.db, c.req.query("projectId"))));

  routes.get("/:id", (c) => {
    const issue = readIssue(deps.db, c.req.param("id"));
    return issue ? c.json(issue) : c.json({ error: "issue_not_found" }, 404);
  });

  return routes;
}
