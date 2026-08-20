import { z } from "zod";

import { ISSUE_STATES } from "../state-machines/issue.js";
import { commitSubjectSchema } from "./commit-subject.js";
import {
  PULL_REQUEST_PUBLICATION_MODES,
  pullRequestContractSchema,
  pullRequestGeneratorAuditSchema,
} from "./entities/pull-request.js";

/** Undefaulted: a caller that names no mode is refused, so an absent value never becomes a silent Draft. */
export const preparePullRequestRequestSchema = z.object({
  subject: commitSubjectSchema,
  body: z.string(),
  /** Remote branch the PR ships as; omitted keeps the run branch. Ignored once the PR exists — its head is its identity. */
  head_ref: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(PULL_REQUEST_PUBLICATION_MODES),
});
export type PreparePullRequestRequest = z.infer<typeof preparePullRequestRequestSchema>;

/** AI-generated metadata for the run's pull request; every field stays editable, and generating publishes nothing. */
export const pullRequestProposalSchema = z.object({
  subject: commitSubjectSchema,
  body: z.string(),
  branch: z.string().min(1),
  /** Extra paragraph for the commit Otomat creates when the workspace still holds uncommitted work. */
  commit_body: z.string().nullable(),
  generator: pullRequestGeneratorAuditSchema,
});
export type PullRequestProposal = z.infer<typeof pullRequestProposalSchema>;

export const pullRequestCommitSchema = z.object({
  sha: z.string(),
  subject: z.string(),
});
export type PullRequestCommit = z.infer<typeof pullRequestCommitSchema>;

/** How the run's workspace stands against the branch the pull request actually shows on GitHub. */
export const pullRequestSyncSchema = z.object({
  state: z.enum(["in_sync", "ahead", "diverged", "unavailable"]),
  /** Uncommitted work in the workspace; a push moves commits, so this stays local until it is committed. */
  dirty: z.boolean(),
  local_head_sha: z.string().nullable(),
  remote_head_sha: z.string().nullable(),
  /** Local commits the pull request branch does not carry yet. */
  ahead: z.array(pullRequestCommitSchema),
  /** Remote commits a force push would drop from the pull request branch. */
  replaced: z.array(pullRequestCommitSchema),
});
export type PullRequestSync = z.infer<typeof pullRequestSyncSchema>;

/** Every code names an actionable Git or GitHub impossibility; how the run's execution ended is not one. */
export const PUBLICATION_BLOCKERS = [
  "worktree_missing",
  "remote_missing",
  "diff_empty",
  "pr_terminal",
] as const;
export const publicationBlockerSchema = z.object({
  code: z.enum(PUBLICATION_BLOCKERS),
  message: z.string().min(1),
});
export type PublicationBlocker = z.infer<typeof publicationBlockerSchema>;

/** What the run's workspace can publish right now, read from git and the stored publication alone. */
export const pullRequestPublishabilitySchema = z.object({
  /** Null when the workspace can open or update a pull request. */
  blocker: publicationBlockerSchema.nullable(),
  /** Null when the workspace or its GitHub remote could not be resolved. */
  repository: z.string().nullable(),
  base_ref: z.string().nullable(),
  /** Branch the next publication would ship, already resolved from the proposal or the workspace. */
  head_ref: z.string().nullable(),
  changed_files: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** Uncommitted work Otomat would commit itself before pushing. */
  dirty: z.boolean(),
});
export type PullRequestPublishability = z.infer<typeof pullRequestPublishabilitySchema>;

/** `pull_request` is null while no PR has been prepared; `sync` is null while none is published to compare against. */
export const pullRequestDetailSchema = z.object({
  pull_request: pullRequestContractSchema.nullable(),
  sync: pullRequestSyncSchema.nullable(),
  publishability: pullRequestPublishabilitySchema,
});
export type PullRequestDetail = z.infer<typeof pullRequestDetailSchema>;

/** `attachment` is the durable link the row carries; `reference`, one exact identifier it names. */
export const pullRequestIssueLinkSchema = z.object({
  id: z.string(),
  identifier: z.string().nullable(),
  title: z.string(),
  status: z.enum(ISSUE_STATES),
  evidence: z.enum(["attachment", "reference"]),
});
export type PullRequestIssueLink = z.infer<typeof pullRequestIssueLinkSchema>;

/** What the reviewer opens a pull request with: the mirror, and the issue resolved for context only. */
export const pullRequestReviewContextSchema = z.object({
  pull_request: pullRequestContractSchema,
  issue: pullRequestIssueLinkSchema.nullable(),
});
export type PullRequestReviewContext = z.infer<typeof pullRequestReviewContextSchema>;

export const pushPullRequestRequestSchema = z.object({
  /** The remote head the user was shown, replayed as a lease: absent, the push may only fast-forward. */
  expected_remote_sha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
});
export type PushPullRequestRequest = z.infer<typeof pushPullRequestRequestSchema>;
