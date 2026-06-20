import { zValidator } from "@hono/zod-validator";
import { getRun } from "@otomat/db";
import { startRunRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { readRunDetail, readRuns } from "../reads.js";
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

/** Mounted at `/api/runs`. Holds the run reads, the start-run command, and the SSE stream. */
export function createRunRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/", (c) => c.json(readRuns(deps.db, c.req.query("issueId"))));

  routes.post(
    "/",
    zValidator("json", startRunRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid_request", issues: result.error.issues }, 400);
      }
    }),
    async (c) => {
      try {
        const run = await deps.launchRun(c.req.valid("json"));
        return c.json(run, 201);
      } catch (error) {
        console.error("[otomat] launch run failed", error);
        return c.json({ error: "run_launch_failed" }, 500);
      }
    },
  );

  routes.get("/:id", (c) => {
    const detail = readRunDetail(deps.db, c.req.param("id"));
    return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
  });

  routes.get("/:id/events", (c) => {
    const runId = c.req.param("id");
    if (!getRun(deps.db, runId)) {
      return c.json({ error: "run_not_found" }, 404);
    }
    const cursor = parseCursor(c.req.query("afterSeq"), c.req.header("Last-Event-ID"));
    return streamRunEvents(c, deps.db, runId, cursor);
  });

  return routes;
}
