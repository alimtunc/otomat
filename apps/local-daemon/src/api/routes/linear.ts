import {
  connectLinearRequestSchema,
  createIssueSourceRequestSchema,
  type LinearErrorCode,
  syncLinearRequestSchema,
} from "@otomat/domain";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { LinearError } from "#linear";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

const LINEAR_ERROR_STATUS: Record<LinearErrorCode, ContentfulStatusCode> = {
  linear_not_connected: 409,
  linear_unauthorized: 409,
  linear_rate_limited: 409,
  linear_unavailable: 503,
  linear_request_failed: 502,
  linear_source_not_found: 404,
  linear_source_already_mapped: 409,
  linear_project_not_found: 400,
};

function refuse(c: Context, error: unknown): Response {
  if (error instanceof LinearError) {
    return c.json({ error: error.code, message: error.message }, LINEAR_ERROR_STATUS[error.code]);
  }
  console.error("[otomat] linear request failed", error);
  return c.json({ error: "linear_request_failed", message: "Linear request failed." }, 500);
}

/**
 * Linear integration surface, mounted at `/api/linear`. `POST /connect` is
 * write-only: the key is validated against Linear, held in daemon memory, and
 * never returned by any endpoint here.
 */
export function createLinearRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/connection", (c) => c.json(deps.linear.connection()));

  routes.post("/connect", validateJson(connectLinearRequestSchema), async (c) =>
    c.json(await deps.linear.connect(c.req.valid("json").api_key)),
  );

  routes.post("/disconnect", (c) => c.json(deps.linear.disconnect()));

  routes.get("/workspace", async (c) => {
    try {
      return c.json(await deps.linear.workspace());
    } catch (error) {
      return refuse(c, error);
    }
  });

  routes.get("/sources", (c) => c.json(deps.linear.sources()));

  routes.post("/sources", validateJson(createIssueSourceRequestSchema), (c) => {
    try {
      return c.json(deps.linear.createSource(c.req.valid("json")), 201);
    } catch (error) {
      return refuse(c, error);
    }
  });

  routes.post("/sync", validateJson(syncLinearRequestSchema), async (c) => {
    try {
      return c.json({ results: await deps.linear.sync(c.req.valid("json").source_id) });
    } catch (error) {
      return refuse(c, error);
    }
  });

  return routes;
}
