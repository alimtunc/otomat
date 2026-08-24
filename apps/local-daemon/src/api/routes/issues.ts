import { randomUUID } from "node:crypto";

import {
  getIssue,
  getProject,
  insertIssue,
  updateIssueProject,
  updateIssueStatus,
} from "@otomat/db";
import {
  attachPullRequestRequestSchema,
  createIssueRequestSchema,
  IllegalTransitionError,
  issueMachine,
  moveIssueProjectRequestSchema,
  setIssueStatusRequestSchema,
} from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { pullRequestImportRefusal } from "../pull-request-refusal.js";
import { toPullRequest } from "../pull-request-serialize.js";
import { readIssue, readIssues } from "../reads.js";

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
    const issue = readIssue(deps.db, id);
    if (!issue) return c.json({ error: "issue_create_failed" }, 500);
    return c.json(issue, 201);
  });

  routes.get("/:id", (c) => {
    const issue = readIssue(deps.db, c.req.param("id"));
    return issue ? c.json(issue) : c.json({ error: "issue_not_found" }, 404);
  });

  routes.patch("/:id/project", validateJson(moveIssueProjectRequestSchema), (c) => {
    const id = c.req.param("id");
    const issue = getIssue(deps.db, id);
    if (!issue)
      return c.json({ error: "issue_not_found", message: "This issue no longer exists." }, 404);
    if (issue.source !== "local") {
      return c.json(
        {
          error: "issue_not_local",
          message: `A ${issue.source} issue belongs to its tracker connection; the next sync would revert the move.`,
        },
        409,
      );
    }
    const { project_id } = c.req.valid("json");
    if (!getProject(deps.db, project_id)) {
      return c.json({ error: "project_not_found", message: "This project no longer exists." }, 400);
    }
    updateIssueProject(deps.db, id, project_id);
    const moved = readIssue(deps.db, id);
    if (!moved)
      return c.json({ error: "issue_not_found", message: "This issue no longer exists." }, 404);
    return c.json(moved);
  });

  routes.patch("/:id/status", validateJson(setIssueStatusRequestSchema), (c) => {
    const id = c.req.param("id");
    const issue = getIssue(deps.db, id);
    if (!issue)
      return c.json({ error: "issue_not_found", message: "This issue no longer exists." }, 404);
    if (issue.source !== "local") {
      return c.json(
        {
          error: "issue_not_local",
          message: `A ${issue.source} issue takes its status from its tracker; set it there instead.`,
        },
        409,
      );
    }
    const { status } = c.req.valid("json");
    try {
      updateIssueStatus(deps.db, id, issueMachine.transition(issue.status, status));
    } catch (error) {
      if (!(error instanceof IllegalTransitionError)) throw error;
      return c.json(
        {
          error: "issue_status_refused",
          message: `An issue that is ${issue.status} cannot be marked ${status}.`,
        },
        409,
      );
    }
    console.log(`[otomat] issue ${id} status set to ${status} by hand`);
    const updated = readIssue(deps.db, id);
    if (!updated)
      return c.json({ error: "issue_not_found", message: "This issue no longer exists." }, 404);
    return c.json(updated);
  });

  routes.get("/:id/pull-requests", async (c) => {
    const id = c.req.param("id");
    if (!getIssue(deps.db, id)) return c.json({ error: "issue_not_found" }, 404);
    const result = await deps.github.listIssuePullRequests(id);
    return c.json({
      attached: result.attached.map(toPullRequest),
      candidates: result.candidates,
      detection: result.detection,
    });
  });

  routes.post("/:id/pull-requests", validateJson(attachPullRequestRequestSchema), async (c) => {
    const id = c.req.param("id");
    if (!getIssue(deps.db, id)) return c.json({ error: "issue_not_found" }, 404);
    try {
      const attached = await deps.github.attachPullRequest(id, c.req.valid("json"));
      return c.json(toPullRequest(attached), 201);
    } catch (error) {
      const refusal = pullRequestImportRefusal(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] attaching a pull request to issue ${id} failed`, error);
      return c.json({ error: "pr_attach_failed" }, 500);
    }
  });

  return routes;
}
