import { CompeteWinnerConflictError } from "@otomat/db";
import { selectCompeteWinnerRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { readCompeteCandidate } from "../reads.js";
import { runDetailJson } from "../run-detail.js";
import { toRunDiffResponse } from "../serialize-run-diff.js";

/** Mounted at `/api/runs`. Holds what a compete group owns: each candidate's isolated diff, and the explicit winner selection. */
export function createCompeteRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/compete-groups/:groupId/candidates/:stepId/diff", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const step = readCompeteCandidate(
      deps.db,
      run.id,
      c.req.param("groupId"),
      c.req.param("stepId"),
    );
    if (!step) return c.json({ error: "compete_candidate_not_found" }, 404);
    try {
      return c.json(toRunDiffResponse(run.id, deps.review.getWorktreeDiff(run, step.id)));
    } catch (error) {
      console.error(`[otomat] compete candidate diff ${step.id} failed`, error);
      return c.json({ error: "compete_diff_failed" }, 500);
    }
  });

  routes.post(
    "/:id/compete-groups/:groupId/winner",
    validateJson(selectCompeteWinnerRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        await deps.supervisor.selectWinner(
          run.id,
          c.req.param("groupId"),
          c.req.valid("json").step_run_id,
        );
      } catch (error) {
        if (error instanceof CompeteWinnerConflictError) {
          return c.json({ error: "compete_winner_conflict", message: error.message }, 409);
        }
        console.error(`[otomat] compete winner selection on run ${run.id} failed`, error);
        return c.json({ error: "compete_winner_selection_failed" }, 500);
      }
      return runDetailJson(deps, c, run.id);
    },
  );

  return routes;
}
