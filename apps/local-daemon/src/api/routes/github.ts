import { sqliteToIso } from "@otomat/db";
import {
  projectPullRequestPublicationOperation,
  publishPullRequestRequestSchema,
  pushPullRequestRequestSchema,
  type PullRequestDetail,
  type PullRequestPublishability,
} from "@otomat/domain";
import { Hono } from "hono";

import { GitHubCliError, GitHubPublicationError, type PullRequestView } from "#github";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toPullRequest } from "../serialize.js";

function detail(
  view: PullRequestView | null,
  publishability: PullRequestPublishability,
): PullRequestDetail {
  const row = view?.row ?? null;
  return {
    pull_request: row ? toPullRequest(row) : null,
    sync: view?.sync ?? null,
    publishability,
    operation: row
      ? projectPullRequestPublicationOperation(row.id, {
          publication_status: row.publication_status,
          failed_phase: row.failed_phase,
          error_code: row.error_code,
          error_message: row.error_message,
          updated_at: sqliteToIso(row.updated_at),
        })
      : null,
  };
}

function refusal(error: unknown): { error: string; message: string } | null {
  if (error instanceof GitHubPublicationError || error instanceof GitHubCliError) {
    return { error: error.code, message: error.message };
  }
  return null;
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
      const refused = refusal(error);
      if (refused) return c.json(refused, 409);
      throw error;
    }
  });

  /** Accepted, not performed: the publication outlives this request, so the answer is its reference and initial state. */
  routes.post(
    "/runs/:id/pr",
    validateJson(publishPullRequestRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        const view = await deps.github.publish(run, c.req.valid("json"));
        return c.json(await publicationDetail(run.id, view), 202);
      } catch (error) {
        const refused = refusal(error);
        if (refused) return c.json(refused, 409);
        console.error(`[otomat] GitHub publication for run ${run.id} failed`, error);
        return c.json({ error: "pr_publish_failed" }, 500);
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
        const refused = refusal(error);
        if (refused) return c.json(refused, 409);
        console.error(`[otomat] GitHub push for run ${run.id} failed`, error);
        return c.json({ error: "pr_push_failed" }, 500);
      }
    },
  );

  return routes;
}
