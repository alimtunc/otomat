import {
  createReviewCommentRequestSchema,
  preparePullRequestRequestSchema,
  requestFixRequestSchema,
} from "@otomat/domain";
import { Hono } from "hono";

import { CommentsNotFixableError, DiffUnavailableError, ReviewAnchorStaleError } from "#review";
import { RunNotResumableError } from "#supervisor";

import type { ApiDeps } from "../deps.js";
import { requireRun, validateJson } from "../guards.js";
import {
  toPullRequest,
  toReview,
  toReviewComment,
  toRun,
  toRunDiffResponse,
} from "../serialize.js";

/** Mounted at `/api/runs`. The per-run review surface: canonical diff, pinned comments, fix turns, local PR draft. */
export function createReviewRoutes(deps: ApiDeps): Hono {
  const routes = new Hono();

  routes.get("/:id/diff", (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    try {
      return c.json(toRunDiffResponse(run.id, deps.review.getRunDiff(run)));
    } catch (error) {
      console.error(`[otomat] diff for run ${run.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/review", (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    const detail = deps.review.getReviewDetail(run.id);
    return c.json({
      review: detail.review ? toReview(detail.review) : null,
      comments: detail.comments.map(toReviewComment),
    });
  });

  routes.post("/:id/review/comments", validateJson(createReviewCommentRequestSchema), (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
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
  });

  routes.post("/:id/review/fix", validateJson(requestFixRequestSchema), async (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
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
  });

  routes.get("/:id/pr", (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    const row = deps.review.getPullRequest(run.id);
    return c.json({ pull_request: row ? toPullRequest(row) : null });
  });

  routes.post("/:id/pr", validateJson(preparePullRequestRequestSchema), (c) => {
    const run = requireRun(c, deps.db);
    if (run instanceof Response) return run;
    try {
      const result = deps.review.preparePullRequest(run, c.req.valid("json"));
      return c.json({ pull_request: toPullRequest(result.row) }, result.created ? 201 : 200);
    } catch (error) {
      console.error(`[otomat] pr prep on run ${run.id} failed`, error);
      return c.json({ error: "pr_prepare_failed" }, 500);
    }
  });

  return routes;
}
