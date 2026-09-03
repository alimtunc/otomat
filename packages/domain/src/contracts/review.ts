import { z } from "zod";

import { CONTEXT_NOTE_MAX_LENGTH } from "../context/limits.js";
import { contextReferencesSchema } from "../context/reference.js";
import { diffFileContractSchema, diffSideSchema } from "./diff.js";
import {
  reviewCommentContractSchema,
  reviewCommentDestinationSchema,
  reviewContractSchema,
  reviewedFileContractSchema,
} from "./entities/reviews.js";
import {
  AGENT_SELECTION_MESSAGE,
  agentSelectionShape,
  executionOptionSelectionsSchema,
  selectsOneAgent,
} from "./execution-config.js";
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

/** GitHub's three verdicts, lowercased on the wire and uppercased only at the provider boundary. */
export const PULL_REQUEST_REVIEW_EVENTS = ["comment", "request_changes", "approve"] as const;
export const pullRequestReviewEventSchema = z.enum(PULL_REQUEST_REVIEW_EVENTS);
export type PullRequestReviewEvent = z.infer<typeof pullRequestReviewEventSchema>;

export function isPullRequestReviewEvent(value: string): value is PullRequestReviewEvent {
  return PULL_REQUEST_REVIEW_EVENTS.some((event) => event === value);
}

/** `reason` is populated either way: a missing verdict is always explained, never silently absent. */
export const reviewSubmissionAvailabilitySchema = z.object({
  events: z.array(pullRequestReviewEventSchema),
  reason: z.string().min(1),
});
export type ReviewSubmissionAvailability = z.infer<typeof reviewSubmissionAvailabilitySchema>;

/** A run's review surface: the review row (null until something hangs from it), its comments newest last, and its reviewed marks. */
export const reviewDetailSchema = z.object({
  review: reviewContractSchema.nullable(),
  comments: z.array(reviewCommentContractSchema),
  /** Only the connected account's own marks; another account's imported Viewed state is never presented here. */
  reviewed_files: z.array(reviewedFileContractSchema),
  fix_authority: reviewFixAuthoritySchema,
  destinations: reviewDestinationAvailabilitySchema,
  submission: reviewSubmissionAvailabilitySchema,
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

/** Submit the pending pull-request comments as one GitHub review; the summary alone is enough to submit. */
export const submitReviewRequestSchema = z
  .object({ body: z.string().max(65_536), event: pullRequestReviewEventSchema })
  .strict();
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>;

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

/** Mark or unmark one file of the diff the reviewer is looking at; re-sending the same request retries a failed synchronization. */
export const setReviewedFileRequestSchema = z
  .object({
    file_path: z.string().min(1),
    diff_sha: z.string().min(1),
    reviewed: z.boolean(),
  })
  .strict();
export type SetReviewedFileRequest = z.infer<typeof setReviewedFileRequestSchema>;

/** Refusals whose message the reviewer must read verbatim to act on them. */
export const REVIEW_COMMENT_ERRORS = [
  "comment_range_invalid",
  "comment_destination_unavailable",
  "comments_not_fixable",
  "review_submission_unavailable",
  "review_submission_empty",
  "review_submission_busy",
  "review_submission_failed",
] as const;
export const reviewCommentErrorSchema = z.object({
  error: z.enum(REVIEW_COMMENT_ERRORS),
  message: z.string(),
});
export type ReviewCommentError = z.infer<typeof reviewCommentErrorSchema>;

/** Ask an agent to fix every open Agent comment as a step appended to the run's plan; the daemon resolves which ones, and the agent is chosen explicitly. */
export const requestFixRequestSchema = z
  .object({
    ...agentSelectionShape,
    model: modelSelectionSchema.optional(),
    /** Provider options for the fix step alone; an absent key keeps what the chosen agent carries. */
    options: executionOptionSelectionsSchema.optional(),
    /** The one instruction the fix step adds to the frozen comments. */
    note: z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH).optional(),
    /** Extra issues and repository files to attach alongside the comments. */
    context: contextReferencesSchema.optional(),
  })
  .strict()
  .refine(selectsOneAgent, { message: AGENT_SELECTION_MESSAGE });
export type RequestFixRequest = z.infer<typeof requestFixRequestSchema>;

export const FIX_REVIEW_COMMENTS_STEP_NAME = "Fix review comments";

export const fixProofPassSchema = z.object({
  agent_session_id: z.string(),
  step_name: z.string(),
});
export type FixProofPass = z.infer<typeof fixProofPassSchema>;

/** The global workspace diff is never offered in place of a proof one of these states cannot give. */
export const commentFixProofSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("reported"),
    pass: fixProofPassSchema,
    /** Its `sha` is what expanding context anchors against. */
    file: diffFileContractSchema,
    excerpt: z.string(),
    /** True when the anchor carried no line range to narrow to, so the excerpt is the whole delta. */
    whole_file: z.boolean(),
  }),
  z.object({
    state: z.literal("no_change"),
    pass: fixProofPassSchema,
    reason: z.string(),
  }),
  z.object({ state: z.literal("unavailable"), reason: z.string() }),
]);
export type CommentFixProof = z.infer<typeof commentFixProofSchema>;

/** Which review surface a call addresses; the daemon mounts one identical surface under each. */
export interface ReviewTarget {
  kind: "run" | "pull_request";
  id: string;
}
