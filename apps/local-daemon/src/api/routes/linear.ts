import {
  connectLinearRequestSchema,
  createIssueSourceRequestSchema,
  type LinearErrorCode,
  syncLinearRequestSchema,
} from "@otomat/domain";
import { Hono } from "hono";
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
  linear_request_superseded: 409,
  linear_source_not_found: 404,
  linear_source_already_mapped: 409,
  linear_source_invalid_selection: 400,
  linear_project_not_found: 400,
};

export function createLinearRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();
  routes.onError((error, c) => {
    if (!(error instanceof LinearError)) throw error;
    return c.json({ error: error.code, message: error.message }, LINEAR_ERROR_STATUS[error.code]);
  });

  routes.get("/connection", (c) => c.json(deps.linear.connection()));

  routes.post("/connect", validateJson(connectLinearRequestSchema), async (c) =>
    c.json(await deps.linear.connect(c.req.valid("json").api_key)),
  );

  routes.post("/disconnect", (c) => c.json(deps.linear.disconnect()));

  routes.get("/workspace", async (c) => c.json(await deps.linear.workspace()));

  routes.get("/sources", (c) => c.json(deps.linear.sources()));

  routes.post("/sources", validateJson(createIssueSourceRequestSchema), async (c) =>
    c.json(await deps.linear.createSource(c.req.valid("json")), 201),
  );

  routes.post("/sync", validateJson(syncLinearRequestSchema), async (c) =>
    c.json({ results: await deps.linear.sync(c.req.valid("json").source_id) }),
  );

  return routes;
}
