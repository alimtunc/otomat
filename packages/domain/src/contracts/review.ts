import { z } from "zod";

import { CONTEXT_MAX_REVIEW_COMMENTS, CONTEXT_NOTE_MAX_LENGTH } from "../context/limits.js";
import { contextReferencesSchema } from "../context/reference.js";
import { RUN_PLAN_STEP_NAME_MAX_LENGTH } from "../plan/limits.js";
import { diffSideSchema } from "./diff.js";
import {
  reviewCommentContractSchema,
  reviewCommentDestinationSchema,
  reviewContractSchema,
} from "./entities/reviews.js";
import { executionOptionSelectionsSchema } from "./execution-config.js";
import { modelSelectionSchema } from "./runtime-model.js";

/** `reason` is user-facing: review-only is always explained, never a silently disabled button. */
export const reviewFixAuthoritySchema = z.object({
  kind: z.enum(["otomat", "external"]),
  reason: z.string(),
});
export type ReviewFixAuthority = z.infer<typeof reviewFixAuthoritySchema>;

/** `reason` is populated either way: the choice is always explained, never silently disabled. */
export const reviewDestinationAvailabilitySchema = z.object({
  pr_review: z.boolean(),
  reason: z.string(),
});
export type ReviewDestinationAvailability = z.infer<typeof reviewDestinationAvailabilitySchema>;

/** A run's review surface: the review row (null before the first comment) plus every comment, newest last. */
export const reviewDetailSchema = z.object({
  review: reviewContractSchema.nullable(),
  comments: z.array(reviewCommentContractSchema),
  fix_authority: reviewFixAuthoritySchema,
  destinations: reviewDestinationAvailabilitySchema,
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

/** Create a comment pinned to the diff the reviewer is looking at; the daemon verifies the anchor. */
export const createReviewCommentRequestSchema = z
  .object({
    file_path: z.string().min(1),
    side: diffSideSchema.default("new"),
    /** First line of a multi-line anchor; absent comments on `line` alone. */
    start_line: z.number().int().positive().nullish(),
    line: z.number().int().nonnegative().nullable(),
    diff_sha: z.string().min(1),
    body: z.string(),
    destination: reviewCommentDestinationSchema.default("agent"),
    /** Replacement text for the anchored range, verbatim and unindented by the composer. */
    suggestion: z.string().nullish(),
  })
  .strict()
  .refine((value) => value.body.trim().length > 0 || typeof value.suggestion === "string", {
    message: "Write a comment or propose a suggestion",
  })
  .refine(
    (value) => value.start_line == null || (value.line !== null && value.start_line <= value.line),
    {
      message: "A range starts at or before the line it ends on",
    },
  )
  .refine((value) => typeof value.suggestion !== "string" || value.line !== null, {
    message: "A suggestion needs a line range, not a whole-file anchor",
  });
export type CreateReviewCommentRequest = z.infer<typeof createReviewCommentRequestSchema>;

/** Refusals whose message the reviewer must read verbatim to act on them. */
export const REVIEW_COMMENT_ERRORS = [
  "comment_range_invalid",
  "comment_destination_unavailable",
  "comment_publication_failed",
] as const;
export const reviewCommentErrorSchema = z.object({
  error: z.enum(REVIEW_COMMENT_ERRORS),
  message: z.string(),
});
export type ReviewCommentError = z.infer<typeof reviewCommentErrorSchema>;

/** Ask an agent to fix the selected open comments as a step appended to the run's plan; the agent is chosen explicitly, never inherited. */
export const requestFixRequestSchema = z
  .object({
    comment_ids: z.array(z.string().min(1)).min(1).max(CONTEXT_MAX_REVIEW_COMMENTS),
    /** Agent profile frozen for the fix step; takes precedence over `runtime`. */
    profile_id: z.string().min(1).optional(),
    runtime: z.string().min(1).optional(),
    model: modelSelectionSchema.optional(),
    /** Provider options for the fix step alone; an absent key keeps what the chosen agent carries. */
    options: executionOptionSelectionsSchema.optional(),
    /** Overrides the default `Fix review comments` step name. */
    name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH).optional(),
    /** The one instruction the fix step adds to the frozen comments. */
    note: z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH).optional(),
    /** Extra issues and repository files to attach alongside the comments. */
    context: contextReferencesSchema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.profile_id) || Boolean(value.runtime), {
    message: "Provide either profile_id or runtime",
  });
export type RequestFixRequest = z.infer<typeof requestFixRequestSchema>;

/** Default name of the step a review fix appends. */
export const FIX_REVIEW_COMMENTS_STEP_NAME = "Fix review comments";
