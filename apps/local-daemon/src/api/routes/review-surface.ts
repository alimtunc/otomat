import {
  createReviewCommentRequestSchema,
  setReviewedFileRequestSchema,
  submitReviewRequestSchema,
} from "@otomat/domain";
import { Hono, type MiddlewareHandler } from "hono";

import {
  CommentDestinationUnavailableError,
  CommentRangeInvalidError,
  DiffUnavailableError,
  ReviewAnchorStaleError,
  ReviewSubmissionBusyError,
  ReviewSubmissionEmptyError,
  ReviewSubmissionFailedError,
  ReviewSubmissionUnavailableError,
} from "#review";

import type { ApiDeps } from "../deps.js";
import { diffFileBlobsErrorResponse, toDiffFileBlobsResponse } from "../diff-file-blobs.js";
import { diffScopeErrorResponse, readDiffScope } from "../diff-scope.js";
import { validateJson, type ReviewSubjectEnv } from "../guards.js";
import { toReviewDiffResponse } from "../serialize-review-diff.js";
import { toReviewComment, toReviewDetail, toReviewedFile } from "../serialize.js";

/** One surface for both subjects: only the guard that names the subject differs, so the two never drift apart. */
export function createReviewSurfaceRoutes(
  deps: ApiDeps,
  guard: MiddlewareHandler<ReviewSubjectEnv>,
): Hono<ReviewSubjectEnv> {
  const routes = new Hono<ReviewSubjectEnv>();

  routes.get("/:id/diff", guard, (c) => {
    const subject = c.get("subject");
    try {
      const scope = readDiffScope(c);
      return c.json(toReviewDiffResponse(subject.id, deps.review.getDiff(subject, scope)));
    } catch (error) {
      const refusal = diffScopeErrorResponse(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] diff for ${subject.kind} ${subject.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/diff/file", guard, (c) => {
    const subject = c.get("subject");
    const path = c.req.query("path") ?? "";
    const sha = c.req.query("sha") ?? "";
    try {
      const scope = readDiffScope(c);
      return c.json(
        toDiffFileBlobsResponse(deps.review.getFileBlobs(subject, { path, sha, scope })),
      );
    } catch (error) {
      const refusal = diffScopeErrorResponse(c, error) ?? diffFileBlobsErrorResponse(c, error);
      if (refusal) return refusal;
      console.error(`[otomat] blobs for ${path} on ${subject.kind} ${subject.id} failed`, error);
      return c.json({ error: "diff_failed" }, 500);
    }
  });

  routes.get("/:id/review", guard, (c) => {
    return c.json(toReviewDetail(deps.review.getReviewDetail(c.get("subject"))));
  });

  /** No refusal branch for GitHub: an outage rides back on the mark's own sync state, which the reviewer retries. */
  routes.post("/:id/review/files", guard, validateJson(setReviewedFileRequestSchema), async (c) => {
    const subject = c.get("subject");
    try {
      const mark = await deps.review.setReviewedFile(subject, c.req.valid("json"));
      return c.json(toReviewedFile(mark));
    } catch (error) {
      console.error(`[otomat] reviewed mark on ${subject.kind} ${subject.id} failed`, error);
      return c.json({ error: "reviewed_mark_failed" }, 500);
    }
  });

  routes.post(
    "/:id/review/comments",
    guard,
    validateJson(createReviewCommentRequestSchema),
    (c) => {
      const subject = c.get("subject");
      try {
        return c.json(toReviewComment(deps.review.addComment(subject, c.req.valid("json"))), 201);
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

  routes.post("/:id/review/submit", guard, validateJson(submitReviewRequestSchema), async (c) => {
    const subject = c.get("subject");
    try {
      return c.json(toReviewDetail(await deps.review.submitReview(subject, c.req.valid("json"))));
    } catch (error) {
      if (error instanceof ReviewSubmissionUnavailableError) {
        return c.json({ error: "review_submission_unavailable", message: error.message }, 409);
      }
      if (error instanceof ReviewSubmissionEmptyError) {
        return c.json({ error: "review_submission_empty", message: error.message }, 422);
      }
      if (error instanceof ReviewSubmissionBusyError) {
        return c.json({ error: "review_submission_busy", message: error.message }, 409);
      }
      if (error instanceof ReviewAnchorStaleError) {
        return c.json({ error: "comment_anchor_stale" }, 409);
      }
      if (error instanceof ReviewSubmissionFailedError) {
        return c.json({ error: "review_submission_failed", message: error.message }, 502);
      }
      console.error(`[otomat] submitting the review of ${subject.id} failed`, error);
      return c.json({ error: "review_submit_failed" }, 500);
    }
  });

  return routes;
}
