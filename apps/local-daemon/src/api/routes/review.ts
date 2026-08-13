import { createReviewCommentRequestSchema, requestFixRequestSchema } from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";
import { ReviewFixBusyError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { diffFileBlobsErrorResponse, toDiffFileBlobsResponse } from "../diff-file-blobs.js";
import { runGuard, validateJson, type RunEnv } from "../guards.js";
import { toRunDiffResponse } from "../serialize-run-diff.js";
import { toReview, toReviewComment, toRun } from "../serialize.js";
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

  routes.get("/:id/diff/file", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const path = c.req.query("path") ?? "";
    const sha = c.req.query("sha") ?? "";
    try {
      return c.json(toDiffFileBlobsResponse(deps.review.getFileBlobs(run, { path, sha })));
    } catch (error) {
      const refusal = diffFileBlobsErrorResponse(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] blobs for ${path} on run ${run.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/review", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const detail = deps.review.getReviewDetail(run.id);
    return c.json({
      review: detail.review ? toReview(detail.review) : null,
      comments: detail.comments.map(toReviewComment),
      fix_authority: detail.fixAuthority,
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
      const request = c.req.valid("json");
      try {
        const updated = await deps.review.requestFix(run, {
          commentIds: request.comment_ids,
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

  return routes;
}
