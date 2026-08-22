import { setNextTurnModelRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { agentConfigErrorResponse } from "#api/agent-config-refusal";
import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { refusalJson } from "#api/refusal";
import { toStepRun } from "#api/serialize";
import { NextTurnModelError, StepStopRefusedError } from "#supervisor";

/** Mounted at `/api/runs`. Commands addressed to one step of a run: the next-turn model revision and the live-turn stop. */
export function createRunStepRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.post(
    "/:id/steps/:stepId/model",
    validateJson(setNextTurnModelRequestSchema),
    runGuard(deps.db),
    (c) => {
      const run = c.get("run");
      const request = c.req.valid("json");
      try {
        const step = deps.supervisor.setNextTurnModel(
          run.id,
          c.req.param("stepId"),
          request.agent_session_id,
          request.current_config_hash,
          request.model,
          request.options,
        );
        return c.json(toStepRun(step));
      } catch (error) {
        if (error instanceof NextTurnModelError) {
          const status =
            error.code === "step_not_found" || error.code === "session_not_found" ? 404 : 409;
          return c.json({ error: error.code, message: error.message }, status);
        }
        const refusal = agentConfigErrorResponse(error);
        if (refusal) return refusalJson(c, refusal);
        console.error(`[otomat] setting next-turn model on run ${run.id} failed`, error);
        return c.json({ error: "next_turn_model_failed" }, 500);
      }
    },
  );

  routes.post("/:id/steps/:stepId/stop", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      const step = await deps.supervisor.stopStep(run.id, c.req.param("stepId"));
      return c.json(toStepRun(step));
    } catch (error) {
      if (error instanceof StepStopRefusedError) {
        const status = error.code === "step_not_found" ? 404 : 409;
        return c.json({ error: error.code, message: error.message }, status);
      }
      console.error(`[otomat] stopping a step on run ${run.id} failed`, error);
      return c.json({ error: "step_stop_failed" }, 500);
    }
  });

  return routes;
}
