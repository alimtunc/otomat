import type { HealthResponse } from "@otomat/domain";
import { Hono } from "hono";

import type { ApiDeps } from "../deps.js";

export function createHealthRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/health", (c) => {
    const body: HealthResponse = {
      status: "ok",
      name: deps.name,
      version: deps.version,
      started_at: deps.startedAt,
      db_path: deps.dbPath,
    };
    return c.json(body);
  });

  return routes;
}
