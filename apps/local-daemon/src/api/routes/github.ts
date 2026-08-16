import { getPullRequestForRun } from "@otomat/db";
import {
  preparePullRequestRequestSchema,
  pushPullRequestRequestSchema,
  type PullRequestDetail,
  type PullRequestPublishability,
} from "@otomat/domain";
import { Hono } from "hono";

import { GitHubPublicationError, type PullRequestView } from "#github";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toPullRequest } from "../serialize.js";

function detail(
  view: PullRequestView | null,
  publishability: PullRequestPublishability,
): PullRequestDetail {
  return {
    pull_request: view ? toPullRequest(view.row) : null,
    sync: view?.sync ?? null,
    publishability,
  };
}

export function createGitHubRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  const publicationDetail = async (
    runId: string,
    view: PullRequestView | null,
  ): Promise<PullRequestDetail> => detail(view, await deps.github.publishability(runId));

  routes.get("/github/connection", async (c) => c.json(await deps.github.connection()));
  routes.post("/github/connect", (c) => c.json(deps.github.connect(), 202));

  routes.get("/runs/:id/pr", runGuard(deps.db), async (c) => {
    const runId = c.get("run").id;
    return c.json(await publicationDetail(runId, await deps.github.getPullRequest(runId)));
  });

  routes.post("/runs/:id/pr/generate", runGuard(deps.db), async (c) => {
    try {
      return c.json(await deps.github.generatePullRequestMetadata(c.get("run")));
    } catch (error) {
      if (error instanceof GitHubPublicationError) {
        return c.json({ error: error.code, message: error.message }, 409);
      }
      throw error;
    }
  });

  routes.post(
    "/runs/:id/pr",
    validateJson(preparePullRequestRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const existed = getPullRequestForRun(deps.db, run.id) !== undefined;
      try {
        const view = await deps.github.publish(run, c.req.valid("json"));
        return c.json(await publicationDetail(run.id, view), existed ? 200 : 201);
      } catch (error) {
        if (error instanceof GitHubPublicationError) {
          return c.json({ error: error.code, message: error.message }, 409);
        }
        console.error(`[otomat] GitHub publication for run ${run.id} failed`, error);
        return c.json({ error: "pr_prepare_failed" }, 500);
      }
    },
  );

  routes.post(
    "/runs/:id/pr/push",
    validateJson(pushPullRequestRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        const view = await deps.github.pushCommits(run.id, c.req.valid("json"));
        return c.json(await publicationDetail(run.id, view));
      } catch (error) {
        if (error instanceof GitHubPublicationError) {
          return c.json({ error: error.code, message: error.message }, 409);
        }
        console.error(`[otomat] GitHub push for run ${run.id} failed`, error);
        return c.json({ error: "pr_push_failed" }, 500);
      }
    },
  );

  return routes;
}
