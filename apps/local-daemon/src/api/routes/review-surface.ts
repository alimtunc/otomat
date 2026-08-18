import { createReviewCommentRequestSchema } from "@otomat/domain";
import { Hono, type MiddlewareHandler } from "hono";

import {
  CommentDestinationUnavailableError,
  CommentPublicationFailedError,
  CommentRangeInvalidError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
} from "#review";

import type { ApiDeps } from "../deps.js";
import { diffFileBlobsErrorResponse, toDiffFileBlobsResponse } from "../diff-file-blobs.js";
import { validateJson, type ReviewSubjectEnv } from "../guards.js";
import { toReviewDiffResponse } from "../serialize-review-diff.js";
import { toReview, toReviewComment } from "../serialize.js";

/** One surface for both subjects: only the guard that names the subject differs, so the two never drift apart. */
export function createReviewSurfaceRoutes(
  deps: ApiDeps,
  guard: MiddlewareHandler<ReviewSubjectEnv>,
): Hono<ReviewSubjectEnv> {
  const routes = new Hono<ReviewSubjectEnv>();

  routes.get("/:id/diff", guard, (c) => {
    const subject = c.get("subject");
    try {
      return c.json(toReviewDiffResponse(subject.id, deps.review.getDiff(subject)));
    } catch (error) {
      console.error(`[otomat] diff for ${subject.kind} ${subject.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/diff/file", guard, (c) => {
    const subject = c.get("subject");
    const path = c.req.query("path") ?? "";
    const sha = c.req.query("sha") ?? "";
    try {
      return c.json(toDiffFileBlobsResponse(deps.review.getFileBlobs(subject, { path, sha })));
    } catch (error) {
      const refusal = diffFileBlobsErrorResponse(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] blobs for ${path} on ${subject.kind} ${subject.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/review", guard, (c) => {
    const detail = deps.review.getReviewDetail(c.get("subject"));
    return c.json({
      review: detail.review ? toReview(detail.review) : null,
      comments: detail.comments.map(toReviewComment),
      fix_authority: detail.fixAuthority,
      destinations: detail.destinations,
    });
  });

  routes.post(
    "/:id/review/comments",
    guard,
    validateJson(createReviewCommentRequestSchema),
    async (c) => {
      const subject = c.get("subject");
      try {
        const comment = await deps.review.addComment(subject, c.req.valid("json"));
        return c.json(toReviewComment(comment), 201);
      } catch (error) {
        if (error instanceof DiffUnavailableError)
          return c.json({ error: "diff_unavailable" }, 409);
        if (error instanceof ReviewAnchorStaleError) {
          return c.json({ error: "comment_anchor_stale" }, 409);
        }
        if (error instanceof CommentRangeInvalidError) {
          return c.json({ error: "comment_range_invalid", message: error.message }, 422);
        }
        if (error instanceof CommentDestinationUnavailableError) {
          return c.json({ error: "comment_destination_unavailable", message: error.message }, 409);
        }
        console.error(`[otomat] comment on ${subject.kind} ${subject.id} failed`, error);
        return c.json({ error: "comment_create_failed" }, 500);
      }
    },
  );

  routes.post("/:id/review/comments/:commentId/publish", guard, async (c) => {
    const subject = c.get("subject");
    const commentId = c.req.param("commentId");
    try {
      return c.json(toReviewComment(await deps.review.publishComment(subject, commentId)));
    } catch (error) {
      if (error instanceof CommentDestinationUnavailableError) {
        return c.json({ error: "comment_destination_unavailable", message: error.message }, 409);
      }
      if (error instanceof ReviewAnchorStaleError) {
        return c.json({ error: "comment_anchor_stale" }, 409);
      }
      if (error instanceof CommentPublicationFailedError) {
        return c.json({ error: "comment_publication_failed", message: error.message }, 502);
      }
      console.error(`[otomat] publishing comment ${commentId} on ${subject.id} failed`, error);
      return c.json({ error: "comment_publish_failed" }, 500);
    }
  });

  return routes;
}
