import { createRunContributionRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { RunContributionNotRetriableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { readRunContributions } from "../reads.js";
import { toRunContribution } from "../serialize.js";

/**
 * The run conversation surface, mounted at `/api/runs`. A post always persists
 * the message, whatever the run is doing; the response carries the honest
 * delivery state the daemon reached — `queued` while the agent is still working.
 */
export function createRunContributionRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/contributions", runGuard(deps.db), (c) =>
    c.json(readRunContributions(deps.db, c.get("run").id)),
  );

  routes.post(
    "/:id/contributions",
    validateJson(createRunContributionRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        const row = await deps.contributeToRun(run.id, c.req.valid("json").body);
        return c.json(toRunContribution(row), 201);
      } catch (error) {
        console.error(`[otomat] contribution on run ${run.id} failed`, error);
        return c.json({ error: "run_contribution_failed" }, 500);
      }
    },
  );

  routes.post("/:id/contributions/deliver", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.deliverRunContributions(run.id);
    } catch (error) {
      console.error(`[otomat] contribution delivery on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_delivery_failed" }, 500);
    }
    return c.json(readRunContributions(deps.db, run.id));
  });

  routes.post("/:id/contributions/:contributionId/retry", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      const row = await deps.retryRunContribution(run.id, c.req.param("contributionId"));
      return c.json(toRunContribution(row));
    } catch (error) {
      if (error instanceof RunContributionNotRetriableError) {
        return c.json({ error: "run_contribution_not_retriable", message: error.message }, 409);
      }
      console.error(`[otomat] contribution retry on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_retry_failed" }, 500);
    }
  });

  return routes;
}
