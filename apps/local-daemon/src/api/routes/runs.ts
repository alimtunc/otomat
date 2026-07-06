import { startRunRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { RunNotResumableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { readRunDetail, readRuns } from "../reads.js";
import { toRun } from "../serialize.js";
import { streamRunEvents } from "../sse.js";

/** Mounted at `/api/runs`. Holds the run reads, the run commands (start/resume/abort), and the SSE stream. */
export function createRunRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/", (c) => c.json(readRuns(deps.db, c.req.query("issueId"))));

  routes.post("/", validateJson(startRunRequestSchema), async (c) => {
    try {
      const run = await deps.launchRun(c.req.valid("json"));
      return c.json(toRun(run), 201);
    } catch (error) {
      console.error("[otomat] launch run failed", error);
      return c.json({ error: "run_launch_failed" }, 500);
    }
  });

  routes.get("/:id", (c) => {
    const detail = readRunDetail(deps.db, c.req.param("id"));
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.post("/:id/resume", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      return c.json(toRun(await deps.resumeRun(run.id)));
    } catch (error) {
      if (error instanceof RunNotResumableError) {
        return c.json({ error: "run_not_resumable" }, 409);
      }
      console.error(`[otomat] resume run ${run.id} failed`, error);
      return c.json({ error: "run_resume_failed" }, 500);
    }
  });

  routes.post("/:id/abort", runGuard(deps.db), async (c) => {
    const run = c.get("run");
    try {
      await deps.abortRun(run.id);
    } catch (error) {
      console.error(`[otomat] abort run ${run.id} failed`, error);
      return c.json({ error: "run_abort_failed" }, 500);
    }
    const detail = readRunDetail(deps.db, run.id);
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.get("/:id/events", runGuard(deps.db), (c) => streamRunEvents(c, deps.db, c.get("run").id));

  return routes;
}
