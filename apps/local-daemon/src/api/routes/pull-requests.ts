import { getAttachedPullRequest } from "@otomat/db";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { pullRequestSubjectGuard } from "../guards.js";
import { pullRequestImportRefusal } from "../pull-request-refusal.js";
import { toPullRequestReviewContext } from "../serialize.js";
import { createReviewSurfaceRoutes } from "./review-surface.js";

/** Mounted at `/api/pull-requests`: the review surface of an adopted pull request, plus refresh and detach. */
export function createPullRequestRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/:id", (c) => {
    const row = getAttachedPullRequest(deps.db, c.req.param("id"));
    if (!row) return c.json({ error: "pull_request_not_found" }, 404);
    return c.json(toPullRequestReviewContext(row, deps.github.pullRequestIssue(row)));
  });

  routes.post("/:id/refresh", async (c) => {
    const id = c.req.param("id");
    try {
      const row = await deps.github.refreshPullRequest(id);
      return c.json(toPullRequestReviewContext(row, deps.github.pullRequestIssue(row)));
    } catch (error) {
      const refusal = pullRequestImportRefusal(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] refreshing pull request ${id} failed`, error);
      return c.json({ error: "pr_refresh_failed" }, 500);
    }
  });

  routes.delete("/:id", (c) => {
    const id = c.req.param("id");
    try {
      deps.github.detachPullRequest(id);
      return c.body(null, 204);
    } catch (error) {
      const refusal = pullRequestImportRefusal(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] detaching pull request ${id} failed`, error);
      return c.json({ error: "pr_detach_failed" }, 500);
    }
  });

  routes.route("/", createReviewSurfaceRoutes(deps, pullRequestSubjectGuard(deps.db)));

  return routes;
}
