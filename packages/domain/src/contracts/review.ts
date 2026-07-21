import { z } from "zod";

import { reviewCommentContractSchema, reviewContractSchema } from "./entities.js";

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

/** Ask an agent to fix the selected open comments as a follow-up turn on the same run. */
export const requestFixRequestSchema = z.object({
  comment_ids: z.array(z.string().min(1)).min(1),
});
export type RequestFixRequest = z.infer<typeof requestFixRequestSchema>;
