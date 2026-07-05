import { Hono } from "hono";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { HTTPException } from "hono/http-exception";

import type { ApiDeps } from "./deps.js";
import { createCatalogRoutes } from "./routes/catalog.js";
import { createHealthRoutes } from "./routes/health.js";
import { createIssueRoutes } from "./routes/issues.js";
import { createReviewRoutes } from "./routes/review.js";
import { createRunRoutes } from "./routes/runs.js";
import { allowedOrigin, hostGuard } from "./security.js";

/**
 * Builds the daemon's Hono app: a host-guard then CORS on `/api/*` (the guard runs
 * first, so a rejected `Host` never reaches CORS), the mounted route groups, and a
 * JSON fallthrough — unmatched routes return 404 `not_found`, `HTTPException`s are
 * passed through, and any other thrown error is logged and returned as 500 `internal_error`.
 */
export function createApiApp(deps: ApiDeps): Hono {
  const app = new Hono();

  app.use("/api/*", hostGuard());
  app.use("/api/*", cors({ origin: allowedOrigin() }));

  app.route("/api", createHealthRoutes(deps));
  app.route("/api", createCatalogRoutes(deps));
  app.route("/api/issues", createIssueRoutes(deps));
  app.route("/api/runs", createRunRoutes(deps));
  app.route("/api/runs", createReviewRoutes(deps));

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
