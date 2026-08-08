import { z } from "zod";

import { RUN_PLAN_STEP_NAME_MAX_LENGTH } from "../plan/limits.js";
import { reviewCommentContractSchema, reviewContractSchema } from "./entities/reviews.js";
import { modelSelectionSchema } from "./runtime-model.js";

/** A run's review surface: the review row (null before the first comment) plus every comment, newest last. */
export const reviewDetailSchema = z.object({
  review: reviewContractSchema.nullable(),
  comments: z.array(reviewCommentContractSchema),
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

/** Create a comment pinned to the diff the reviewer is looking at; the daemon verifies the anchor. */
export const createReviewCommentRequestSchema = z.object({
  file_path: z.string().min(1),
  line: z.number().int().nonnegative(),
  diff_sha: z.string().min(1),
  body: z.string().min(1),
});
export type CreateReviewCommentRequest = z.infer<typeof createReviewCommentRequestSchema>;

/** Ask an agent to fix the selected open comments as a step appended to the run's plan; the agent is chosen explicitly, never inherited. */
export const requestFixRequestSchema = z
  .object({
    comment_ids: z.array(z.string().min(1)).min(1),
    /** Agent profile frozen for the fix step; takes precedence over `runtime`. */
    profile_id: z.string().min(1).optional(),
    runtime: z.string().min(1).optional(),
    model: modelSelectionSchema.optional(),
    /** Overrides the default `Fix review comments` step name. */
    name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.profile_id) || Boolean(value.runtime), {
    message: "Provide either profile_id or runtime",
  });
export type RequestFixRequest = z.infer<typeof requestFixRequestSchema>;

/** Default name of the step a review fix appends. */
export const FIX_REVIEW_COMMENTS_STEP_NAME = "Fix review comments";
