import { Hono } from "hono";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";

import type { ApiDeps } from "./deps.js";
import { createCatalogRoutes } from "./routes/catalog.js";
import { createHealthRoutes } from "./routes/health.js";
import { createIssueRoutes } from "./routes/issues.js";
import { createRunRoutes } from "./routes/runs.js";
import { allowedOrigin, hostGuard } from "./security.js";

export function createApiApp(deps: ApiDeps): Hono {
  const app = new Hono();

  app.use("/api/*", hostGuard());
  app.use("/api/*", cors({ origin: allowedOrigin() }));

  app.route("/api", createHealthRoutes(deps));
  app.route("/api", createCatalogRoutes(deps));
  app.route("/api/issues", createIssueRoutes(deps));
  app.route("/api/runs", createRunRoutes(deps));

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error("[otomat] api error", err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}

/** Prints the registered method+path table. Dev aid — call from the daemon behind a flag. */
export function logApiRoutes(app: Hono): void {
  showRoutes(app, { verbose: true });
}
