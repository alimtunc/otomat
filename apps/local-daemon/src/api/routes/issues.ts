import { randomUUID } from "node:crypto";

import { getIssue, getProject, insertIssue } from "@otomat/db";
import { createIssueRequestSchema, issueMachine } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { readIssue, readIssues } from "../reads.js";
import { toIssue } from "../serialize.js";

/** Mounted at `/api/issues`. */
export function createIssueRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readIssues(deps.db, c.req.query("projectId"))));

  routes.post("/", validateJson(createIssueRequestSchema), (c) => {
    const request = c.req.valid("json");
    if (!getProject(deps.db, request.project_id)) {
      return c.json({ error: "project_not_found" }, 400);
    }
    const id = randomUUID();
    insertIssue(deps.db, {
      id,
      project_id: request.project_id,
      title: request.title,
      body: request.body ?? null,
      status: issueMachine.initial,
      source: "local",
    });
    const issue = getIssue(deps.db, id);
    if (!issue) return c.json({ error: "issue_create_failed" }, 500);
    return c.json(toIssue(issue), 201);
  });

  routes.get("/:id", (c) => {
    const issue = readIssue(deps.db, c.req.param("id"));
    return issue ? c.json(issue) : c.json({ error: "issue_not_found" }, 404);
  });

  return routes;
}
