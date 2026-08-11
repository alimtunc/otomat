import { updateAgentCapacityRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";

/** Mounted at `/api/settings`. Every execution host owns and answers for its own settings. */
export function createSettingsRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/capacity", (c) => c.json(deps.agentCapacity()));

  routes.put("/capacity", validateJson(updateAgentCapacityRequestSchema), (c) => {
    const { max_concurrent_sessions } = c.req.valid("json");
    return c.json(deps.setAgentCapacity(max_concurrent_sessions));
  });

  return routes;
}
