import { overrideStepDeliveryRequestSchema, setNextTurnModelRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { agentConfigErrorResponse } from "#api/agent-config-refusal";
import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { commandRefusalJson, refusalJson } from "#api/refusal";
import { toStepRun } from "#api/serialize";
import {
  DeliveryOverrideRefusedError,
  NextTurnModelError,
  StepStopRefusedError,
} from "#supervisor";

/** Mounted at `/api/runs`. Commands addressed to one step of a run. */
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
        if (error instanceof NextTurnModelError) return commandRefusalJson(c, error);
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
      if (error instanceof StepStopRefusedError) return commandRefusalJson(c, error);
      console.error(`[otomat] stopping a step on run ${run.id} failed`, error);
      return c.json({ error: "step_stop_failed" }, 500);
    }
  });

  routes.post(
    "/:id/steps/:stepId/override-delivery",
    validateJson(overrideStepDeliveryRequestSchema),
    runGuard(deps.db),
    (c) => {
      const run = c.get("run");
      try {
        const step = deps.supervisor.overrideStepDelivery(
          run.id,
          c.req.param("stepId"),
          c.req.valid("json").note,
        );
        return c.json(toStepRun(step));
      } catch (error) {
        if (error instanceof DeliveryOverrideRefusedError) return commandRefusalJson(c, error);
        console.error(`[otomat] overriding the delivery guard on run ${run.id} failed`, error);
        return c.json({ error: "step_delivery_override_failed" }, 500);
      }
    },
  );

  return routes;
}
