import { getAttachedPullRequest } from "@otomat/db";
import { mergePullRequestRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { pullRequestSubjectGuard, validateJson } from "../guards.js";
import { pullRequestImportRefusal, pullRequestProviderRefusal } from "../pull-request-refusal.js";
import { toPullRequestOverview, toPullRequestReviewContext } from "../pull-request-serialize.js";
import { createReviewSurfaceRoutes } from "./review-surface.js";

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

  routes.get("/:id/overview", async (c) => {
    const id = c.req.param("id");
    try {
      const overview = await deps.github.pullRequestOverview(id);
      return c.json(toPullRequestOverview(overview, deps.github.pullRequestIssue(overview.row)));
    } catch (error) {
      const refusal = pullRequestProviderRefusal(c, error, "pr_overview_failed");
      if (refusal) return refusal;
      console.error(`[otomat] overview for pull request ${id} failed`, error);
      return c.json({ error: "pr_overview_failed" }, 500);
    }
  });

  routes.post("/:id/merge", validateJson(mergePullRequestRequestSchema), async (c) => {
    const id = c.req.param("id");
    try {
      const row = await deps.github.mergePullRequest(id, c.req.valid("json").method);
      return c.json(toPullRequestReviewContext(row, deps.github.pullRequestIssue(row)));
    } catch (error) {
      const refusal = pullRequestProviderRefusal(c, error, "merge_failed");
      if (refusal) return refusal;
      console.error(`[otomat] merging pull request ${id} failed`, error);
      return c.json({ error: "merge_failed" }, 500);
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
