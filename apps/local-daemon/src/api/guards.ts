import { zValidator } from "@hono/zod-validator";
import {
  getRun,
  getWorkflowPreset,
  type Db,
  type RunRow,
  type WorkflowPresetRow,
} from "@otomat/db";
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

/** Hono env for the `/:id` preset routes: {@link workflowPresetGuard} resolves `c.var.preset`. */
export type WorkflowPresetEnv = { Variables: { preset: WorkflowPresetRow } };

/** Resolves the `/:id` param to its preset row, or short-circuits with a 404 `preset_not_found`. */
export function workflowPresetGuard(db: Db) {
  return createMiddleware<WorkflowPresetEnv>(async (c, next) => {
    const id = c.req.param("id") ?? "";
    const preset = getWorkflowPreset(db, id);
    if (!preset) {
      return c.json({ error: "preset_not_found", message: `workflow preset ${id} not found` }, 404);
    }
    c.set("preset", preset);
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
