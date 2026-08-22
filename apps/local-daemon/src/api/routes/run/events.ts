import { getStepRun } from "@otomat/db";
import type { RunEventWindow, StepEventWindow } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "#api/deps";
import { runGuard, type RunEnv } from "#api/guards";
import { nonNegativeInt } from "#api/query-params";
import { streamRunEvents } from "#api/sse";
import { readRunEventWindow, readStepEventWindow } from "#events";

export function createRunEventRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/events", runGuard(deps.db), (c) => streamRunEvents(c, deps.db, c.get("run").id));

  routes.get("/:id/events/window", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const page = readRunEventWindow(deps.db, run.id, {
      before: nonNegativeInt(c.req.query("before")),
      limit: nonNegativeInt(c.req.query("limit")),
    });
    return c.json({
      run_id: run.id,
      events: page.events,
      older_cursor: page.olderCursor,
    } satisfies RunEventWindow);
  });

  routes.get("/:id/steps/:stepId/events/window", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const stepRunId = c.req.param("stepId");
    if (getStepRun(deps.db, stepRunId)?.run_id !== run.id) {
      return c.json({ error: "step_not_found" }, 404);
    }
    const page = readStepEventWindow(deps.db, run.id, stepRunId, {
      before: nonNegativeInt(c.req.query("before")),
      limit: nonNegativeInt(c.req.query("limit")),
    });
    return c.json({
      run_id: run.id,
      step_run_id: stepRunId,
      events: page.events,
      older_cursor: page.olderCursor,
    } satisfies StepEventWindow);
  });

  return routes;
}
