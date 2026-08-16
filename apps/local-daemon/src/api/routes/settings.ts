import {
  readExecutionDefaults,
  readPullRequestGenerator,
  writeExecutionDefaults,
  writePullRequestGenerator,
} from "@otomat/db";
import { executionDefaultsSchema, updateAgentCapacityRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { validateExecutionDefaults } from "#agents";

import { agentConfigErrorResponse } from "../agent-config-refusal.js";
import type { ApiDeps } from "../deps.js";
import { validateJson } from "../guards.js";
import { refusalJson } from "../refusal.js";

/** Mounted at `/api/settings`. Every execution host owns and answers for its own settings. */
export function createSettingsRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/capacity", (c) => c.json(deps.supervisor.capacity()));

  routes.put("/capacity", validateJson(updateAgentCapacityRequestSchema), (c) => {
    const { max_concurrent_sessions } = c.req.valid("json");
    return c.json(deps.supervisor.setCapacity(max_concurrent_sessions));
  });

  routes.get("/execution-defaults", (c) => c.json(readExecutionDefaults(deps.db)));

  routes.put("/execution-defaults", validateJson(executionDefaultsSchema), (c) => {
    const defaults = c.req.valid("json");
    try {
      validateExecutionDefaults(defaults);
    } catch (error) {
      const refusal = agentConfigErrorResponse(error);
      if (!refusal) throw error;
      return refusalJson(c, refusal);
    }
    writeExecutionDefaults(deps.db, defaults);
    return c.json(readExecutionDefaults(deps.db));
  });

  routes.get("/pr-generator", (c) => c.json(readPullRequestGenerator(deps.db)));

  routes.put("/pr-generator", validateJson(executionDefaultsSchema), (c) => {
    const generator = c.req.valid("json");
    try {
      validateExecutionDefaults(generator);
    } catch (error) {
      const refusal = agentConfigErrorResponse(error);
      if (!refusal) throw error;
      return refusalJson(c, refusal);
    }
    writePullRequestGenerator(deps.db, generator);
    return c.json(readPullRequestGenerator(deps.db));
  });

  return routes;
}
