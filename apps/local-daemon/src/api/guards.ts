import { zValidator } from "@hono/zod-validator";
import { getRun, type Db, type RunRow } from "@otomat/db";
import type { Context } from "hono";
import type { ZodType } from "zod";

/** Resolves the `/:id` param to its run row, or a 404 Response the caller returns as-is. */
export function requireRun(c: Context, db: Db): RunRow | Response {
  const runId = c.req.param("id") ?? "";
  return getRun(db, runId) ?? c.json({ error: "run_not_found" }, 404);
}

/** `zValidator("json", …)` returning a uniform 400 `invalid_request` on schema failure. */
export function validateJson<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "invalid_request", issues: result.error.issues }, 400);
    }
  });
}
