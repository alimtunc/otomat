import { createReviewCommentRequestSchema, requestFixRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";
import { RunNotResumableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toReview, toReviewComment, toRun, toRunDiffResponse } from "../serialize.js";

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

  routes.post(
    "/:id/review/fix",
    validateJson(requestFixRequestSchema),
    runGuard(deps.db),
    async (c) => {
      const run = c.get("run");
      try {
        const preparation = deps.review.prepareFix(run, c.req.valid("json").comment_ids);
        const updated = await deps.fixRun(run.id, preparation.prompt);
        deps.review.markFixRequested(run.id, preparation.commentIds);
        return c.json(toRun(updated));
      } catch (error) {
        if (error instanceof CommentsNotFixableError) {
          return c.json({ error: "comments_not_fixable" }, 409);
        }
        if (error instanceof RunNotResumableError) {
          return c.json({ error: "run_not_fixable" }, 409);
        }
        console.error(`[otomat] fix request on run ${run.id} failed`, error);
        return c.json({ error: "fix_request_failed" }, 500);
      }
    },
  );

  return routes;
}
