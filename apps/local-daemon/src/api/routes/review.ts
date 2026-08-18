import { requestFixRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError } from "#review";
import { ReviewFixBusyError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, runSubjectGuard, validateJson, type RunEnv } from "../guards.js";
import { toRun } from "../serialize.js";
import { appendStepSelector, stepAppendErrorResponse } from "../step-append.js";
import { createReviewSurfaceRoutes } from "./review-surface.js";

/** Mounted at `/api/runs`: the shared review surface, plus the AI fix only a run can carry. */
export function createReviewRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.post(
    "/:id/review/fix",
    validateJson(requestFixRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const request = c.req.valid("json");
      try {
        const updated = await deps.review.requestFix(run, {
          commentIds: request.comment_ids,
          note: request.note ?? null,
          references: request.context ?? [],
          selector: appendStepSelector(request),
          overrides: { model: request.model, options: request.options },
          ...(request.name ? { name: request.name } : {}),
        });
        return c.json(toRun(updated), 201);
      } catch (error) {
        if (error instanceof CommentsNotFixableError) {
          return c.json({ error: "comments_not_fixable" }, 409);
        }
        if (error instanceof ReviewFixBusyError) {
          return c.json({ error: "workspace_busy", message: error.message }, 409);
        }
        const refusal = stepAppendErrorResponse(c, error);
        if (refusal) return refusal;
        console.error(`[otomat] fix request on run ${run.id} failed`, error);
        return c.json({ error: "fix_request_failed" }, 500);
      }
    },
  );

  routes.route("/", createReviewSurfaceRoutes(deps, runSubjectGuard(deps.db)));

  return routes;
}
