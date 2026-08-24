import { answerRunInteractionRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { readRunInteractions } from "#api/reads";
import { toRunInteraction } from "#api/serialize";
import { RunInteractionRefusedError } from "#supervisor";

/** Mounted at `/api/runs`. The questions a runtime blocked a turn on, and the one command that answers one. */
export function createRunInteractionRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/interactions", runGuard(deps.db), (c) =>
    c.json(readRunInteractions(deps.db, c.get("run").id)),
  );

  routes.post(
    "/:id/interactions/:interactionId/answer",
    validateJson(answerRunInteractionRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        const row = await deps.supervisor.answerInteraction(
          run.id,
          c.req.param("interactionId"),
          c.req.valid("json").answer,
        );
        return c.json(toRunInteraction(row));
      } catch (error) {
        if (error instanceof RunInteractionRefusedError) {
          const status = error.code === "run_interaction_not_found" ? 404 : 409;
          return c.json({ error: error.code, message: error.message }, status);
        }
        console.error(`[otomat] interaction answer on run ${run.id} failed`, error);
        return c.json({ error: "run_interaction_answer_failed" }, 500);
      }
    },
  );

  return routes;
}
