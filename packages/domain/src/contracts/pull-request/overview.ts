import { z } from "zod";

import { pullRequestContractSchema } from "../entities/pull-request.js";
import { pullRequestIssueLinkSchema } from "./detail.js";

/** One context of the pull request's status rollup, kept individually so a reviewer sees which check is red. */
export const pullRequestCheckSchema = z.object({
  name: z.string().min(1),
  state: z.enum(["passing", "failing", "pending"]),
  url: z.string().nullable(),
});
export type PullRequestCheck = z.infer<typeof pullRequestCheckSchema>;

const PULL_REQUEST_REVIEW_STATES = [
  "approved",
  "changes_requested",
  "commented",
  "dismissed",
  "pending",
] as const;
export const pullRequestReviewStateSchema = z.enum(PULL_REQUEST_REVIEW_STATES);
export type PullRequestReviewState = z.infer<typeof pullRequestReviewStateSchema>;

/** The latest review each reviewer left, as GitHub reports it. */
export const pullRequestSubmittedReviewSchema = z.object({
  author_login: z.string().nullable(),
  state: pullRequestReviewStateSchema,
  submitted_at: z.iso.datetime().nullable(),
});
export type PullRequestSubmittedReview = z.infer<typeof pullRequestSubmittedReviewSchema>;

/** Rebase is out: Otomat merges what the reviewer sees, and a rebase rewrites it. */
const PULL_REQUEST_MERGE_METHODS = ["merge", "squash"] as const;
export const pullRequestMergeMethodSchema = z.enum(PULL_REQUEST_MERGE_METHODS);
export type PullRequestMergeMethod = z.infer<typeof pullRequestMergeMethodSchema>;

const PULL_REQUEST_MERGE_BLOCKERS = [
  "not_authorized",
  "no_permission",
  "no_method",
  "not_open",
  "conflicting",
  "behind_base",
  "checks_pending",
  "blocked",
  "unknown",
] as const;
export const pullRequestMergeBlockerSchema = z.enum(PULL_REQUEST_MERGE_BLOCKERS);
export type PullRequestMergeBlocker = z.infer<typeof pullRequestMergeBlockerSchema>;

/** `reason` is user-facing either way: why the merge is offered, or precisely why it is not. */
export const pullRequestMergeAvailabilitySchema = z.object({
  methods: z.array(pullRequestMergeMethodSchema),
  blocker: pullRequestMergeBlockerSchema.nullable(),
  reason: z.string().min(1),
});
export type PullRequestMergeAvailability = z.infer<typeof pullRequestMergeAvailabilitySchema>;

/** Everything the reviewer opens a pull request with, read from GitHub and mirrored on the way. */
export const pullRequestOverviewSchema = z.object({
  pull_request: pullRequestContractSchema,
  issue: pullRequestIssueLinkSchema.nullable(),
  repository: z.string().min(1),
  checks: z.array(pullRequestCheckSchema),
  reviews: z.array(pullRequestSubmittedReviewSchema),
  commits: z.number().int().nonnegative(),
  changed_files: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** Commits the base carries that the head does not; a stale head is merged at the operator's risk. */
  behind_base: z.boolean(),
  merge: pullRequestMergeAvailabilitySchema,
});
export type PullRequestOverview = z.infer<typeof pullRequestOverviewSchema>;

export const mergePullRequestRequestSchema = z
  .object({ method: pullRequestMergeMethodSchema })
  .strict();
export type MergePullRequestRequest = z.infer<typeof mergePullRequestRequestSchema>;
