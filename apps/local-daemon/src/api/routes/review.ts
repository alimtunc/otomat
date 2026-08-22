import {
  commentFixProofSchema,
  appendedRunStepResponseSchema,
  executableSteps,
  requestFixRequestSchema,
  runCommitsResponseSchema,
} from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError, type FixRequest } from "#review";
import { ReviewFixBusyError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, runSubjectGuard, validateJson, type RunEnv } from "../guards.js";
import { toRun } from "../serialize.js";
import { appendStepSelector, stepAppendErrorResponse } from "../step-append.js";
import { createReviewSurfaceRoutes } from "./review-surface.js";

/** Mounted at `/api/runs`: the shared review surface, plus the reads and the AI fix only a run can carry. */
export function createReviewRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/commits", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      return c.json(
        runCommitsResponseSchema.parse({ run_id: run.id, ...deps.review.getBranchCommits(run.id) }),
      );
    } catch (error) {
      console.error(`[otomat] commits for run ${run.id} failed`, error);
      return c.json({ error: "commits_failed" }, 500);
    }
  });

  routes.get("/:id/review/comments/:commentId/fix-proof", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const commentId = c.req.param("commentId");
    try {
      return c.json(commentFixProofSchema.parse(deps.review.getCommentFixProof(run.id, commentId)));
    } catch (error) {
      console.error(`[otomat] fix proof for comment ${commentId} on run ${run.id} failed`, error);
      return c.json({ error: "fix_proof_failed" }, 500);
    }
  });

  routes.post(
    "/:id/review/fix",
    validateJson(requestFixRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const request = c.req.valid("json");
      try {
        const fix: FixRequest = {
          commentIds: request.comment_ids,
          note: request.note ?? null,
          references: request.context ?? [],
          selector: appendStepSelector(request),
          overrides: { model: request.model, options: request.options },
        };
        const updated = await deps.review.requestFix(run, fix);
        const step = executableSteps(updated.plan_json).at(-1);
        if (!step) throw new Error(`run ${run.id} has no review-fix step`);
        return c.json(
          appendedRunStepResponseSchema.parse({ run: toRun(updated), step_run_id: step.id }),
          201,
        );
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
