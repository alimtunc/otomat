import { createRunContributionRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { readRunContributions } from "#api/reads";
import { toRunContribution } from "#api/serialize";
import {
  RunContributionNotCancelableError,
  RunContributionNotFoundError,
  RunContributionNotRetriableError,
  RunContributionStepClosedError,
  RunContributionTargetChangedError,
} from "#supervisor";

/** Mounted at `/api/runs`. The step conversation surface: a post always persists the message and returns its honest delivery state. */
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
      const { step_run_id, target_agent_session_id, target_config_hash, body } =
        c.req.valid("json");
      try {
        const row = await deps.supervisor.contribute(
          run.id,
          step_run_id,
          target_agent_session_id,
          target_config_hash,
          body,
        );
        return c.json(toRunContribution(row), 201);
      } catch (error) {
        if (error instanceof RunContributionNotFoundError) {
          return c.json({ error: "run_contribution_step_not_found", message: error.message }, 404);
        }
        if (error instanceof RunContributionStepClosedError) {
          return c.json({ error: "run_contribution_step_closed", message: error.message }, 409);
        }
        if (error instanceof RunContributionTargetChangedError) {
          return c.json({ error: error.code, message: error.message }, 409);
        }
        console.error(`[otomat] contribution on run ${run.id} failed`, error);
        return c.json({ error: "run_contribution_failed" }, 500);
      }
    },
  );

  routes.post("/:id/contributions/deliver", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.supervisor.deliverContributions(run.id);
    } catch (error) {
      console.error(`[otomat] contribution delivery on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_delivery_failed" }, 500);
    }
    return c.json(readRunContributions(deps.db, run.id));
  });

  routes.post("/:id/contributions/:contributionId/retry", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      const row = await deps.supervisor.retryContribution(run.id, c.req.param("contributionId"));
      return c.json(toRunContribution(row));
    } catch (error) {
      if (error instanceof RunContributionNotFoundError) {
        return c.json({ error: "run_contribution_not_found", message: error.message }, 404);
      }
      if (error instanceof RunContributionNotRetriableError) {
        return c.json({ error: "run_contribution_not_retriable", message: error.message }, 409);
      }
      console.error(`[otomat] contribution retry on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_retry_failed" }, 500);
    }
  });

  routes.post("/:id/contributions/:contributionId/cancel", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      const row = deps.supervisor.cancelContribution(run.id, c.req.param("contributionId"));
      return c.json(toRunContribution(row));
    } catch (error) {
      if (error instanceof RunContributionNotFoundError) {
        return c.json({ error: "run_contribution_not_found", message: error.message }, 404);
      }
      if (error instanceof RunContributionNotCancelableError) {
        return c.json({ error: "run_contribution_not_cancelable", message: error.message }, 409);
      }
      console.error(`[otomat] contribution cancel on run ${run.id} failed`, error);
      return c.json({ error: "run_contribution_cancel_failed" }, 500);
    }
  });

  return routes;
}
