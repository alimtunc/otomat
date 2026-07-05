import { startRunRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { RunNotResumableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { requireRun, validateJson } from "../guards.js";
import { readRunDetail, readRuns } from "../reads.js";
import { toRun } from "../serialize.js";
import { streamRunEvents } from "../sse.js";

/** SSE resume cursor: explicit `?afterSeq` wins, else the `Last-Event-ID` from a reconnecting EventSource. */
function parseCursor(
  query: string | undefined,
  lastEventId: string | undefined,
): number | undefined {
  const raw = query ?? lastEventId;
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Mounted at `/api/runs`. Holds the run reads, the run commands (start/resume/abort), and the SSE stream. */
export function createRunRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

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

  routes.post("/:id/resume", async (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
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

  routes.post("/:id/abort", async (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    try {
      await deps.abortRun(run.id);
    } catch (error) {
      console.error(`[otomat] abort run ${run.id} failed`, error);
      return c.json({ error: "run_abort_failed" }, 500);
    }
    const detail = readRunDetail(deps.db, run.id);
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.get("/:id/events", (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    const cursor = parseCursor(c.req.query("afterSeq"), c.req.header("Last-Event-ID"));
    return streamRunEvents(c, deps.db, run.id, cursor);
  });

  return routes;
}
