import { preparePullRequestRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { GitHubPublicationError } from "#github";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toPullRequest } from "../serialize.js";

export function createGitHubRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/github/connection", async (c) => c.json(await deps.github.connection()));
  routes.post("/github/connect", (c) => c.json(deps.github.connect(), 202));

  routes.get("/runs/:id/pr", runGuard(deps.db), (c) => {
    const result = deps.github.getPullRequest(c.get("run").id);
    return c.json({
      pull_request: result ? toPullRequest(result.row, result.hasUnpublishedChanges) : null,
    });
  });

  routes.post(
    "/runs/:id/pr",
    validateJson(preparePullRequestRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const existed = deps.github.getPullRequest(run.id) !== null;
      try {
        const result = await deps.github.publish(run, c.req.valid("json"));
        return c.json(
          { pull_request: toPullRequest(result.row, result.hasUnpublishedChanges) },
          existed ? 200 : 201,
        );
      } catch (error) {
        if (error instanceof GitHubPublicationError) {
          return c.json({ error: error.code }, 409);
        }
        console.error(`[otomat] GitHub publication for run ${run.id} failed`);
        return c.json({ error: "pr_prepare_failed" }, 500);
      }
    },
  );

  return routes;
}
