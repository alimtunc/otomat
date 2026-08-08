import {
  createReviewCommentRequestSchema,
  FIX_REVIEW_COMMENTS_STEP_NAME,
  requestFixRequestSchema,
} from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toReview, toReviewComment, toRun, toRunDiffResponse } from "../serialize.js";
import { appendStepSelector, stepAppendErrorResponse } from "../step-append.js";

export function createReviewRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/diff", runGuard(deps.db), (c) => {
    const run = c.get("run");
    try {
      return c.json(toRunDiffResponse(run.id, deps.review.getWorktreeDiff(run)));
    } catch (error) {
      console.error(`[otomat] diff for run ${run.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/review", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const detail = deps.review.getReviewDetail(run.id);
    return c.json({
      review: detail.review ? toReview(detail.review) : null,
      comments: detail.comments.map(toReviewComment),
    });
  });

  routes.post(
    "/:id/review/comments",
    validateJson(createReviewCommentRequestSchema),
    runGuard(deps.db),
    (c) => {
      const run = c.get("run");
      try {
        return c.json(toReviewComment(deps.review.addComment(run, c.req.valid("json"))), 201);
      } catch (error) {
        if (error instanceof DiffUnavailableError) {
          return c.json({ error: "diff_unavailable" }, 409);
        }
        if (error instanceof ReviewAnchorStaleError) {
          return c.json({ error: "comment_anchor_stale" }, 409);
        }
        console.error(`[otomat] comment on run ${run.id} failed`, error);
        return c.json({ error: "comment_create_failed" }, 500);
      }
    },
  );

  // A fix is an appended step, not a resumed session: it carries its own frozen
  // comment/diff context and the agent the user picked for it.
  routes.post(
    "/:id/review/fix",
    validateJson(requestFixRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      const request = c.req.valid("json");
      try {
        const preparation = deps.review.prepareFix(run, request.comment_ids);
        const updated = await deps.appendRunStep(run.id, {
          name: request.name ?? FIX_REVIEW_COMMENTS_STEP_NAME,
          prompt: preparation.prompt,
          selector: appendStepSelector(request),
          ...(request.model ? { model: request.model } : {}),
          dependsOn: preparation.dependsOn,
          origin: "review_fix",
        });
        deps.review.markFixRequested(run.id, preparation.commentIds);
        return c.json(toRun(updated), 201);
      } catch (error) {
        if (error instanceof CommentsNotFixableError) {
          return c.json({ error: "comments_not_fixable" }, 409);
        }
        const refusal = stepAppendErrorResponse(c, error);
        if (refusal) return refusal;
        console.error(`[otomat] fix request on run ${run.id} failed`, error);
        return c.json({ error: "fix_request_failed" }, 500);
      }
    },
  );

  return routes;
}
