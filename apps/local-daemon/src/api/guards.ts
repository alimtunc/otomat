import { zValidator } from "@hono/zod-validator";
import { getRun, type Db, type RunRow } from "@otomat/db";
import { createMiddleware } from "hono/factory";
import type { ZodType } from "zod";

/** Hono env for the `/:id` run routes: {@link runGuard} resolves the row into `c.var.run`. */
export type RunEnv = { Variables: { run: RunRow } };

/** Resolves the `/:id` param to its run row, or short-circuits with a 404 `run_not_found`. */
export function runGuard(db: Db) {
  return createMiddleware<RunEnv>(async (c, next) => {
    const run = getRun(db, c.req.param("id") ?? "");
    if (!run) return c.json({ error: "run_not_found" }, 404);
    c.set("run", run);
    await next();
  });
}

/** `zValidator("json", …)` returning a uniform 400 `invalid_request` on schema failure. */
export function validateJson<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "invalid_request", issues: result.error.issues }, 400);
    }
  });
}
