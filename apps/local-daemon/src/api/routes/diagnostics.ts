import { Hono } from "hono";

import type { DiagnosticLogRing } from "#diagnostics";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

function boundedLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Serves this host's redacted excerpt for one correlation id. There is deliberately no route for
 * the unfiltered log, the database, or a run's output: a caller can only ask what this daemon
 * recorded about a request it already made.
 */
export function createDiagnosticsRoutes(ring: DiagnosticLogRing): Hono {
  const routes = new Hono();

  routes.get("/diagnostics/logs", (c) => {
    const correlationId = c.req.query("correlation_id");
    if (correlationId === undefined || correlationId === "") {
      return c.json({ error: "correlation_id_required" }, 400);
    }
    return c.json(ring.excerpt(correlationId, boundedLimit(c.req.query("limit"))));
  });

  return routes;
}
