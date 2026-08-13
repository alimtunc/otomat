import { z } from "zod";

import { pullRequestContractSchema } from "./entities/pull-request.js";

/** How a publication leaves the pull request on GitHub. Explicit at every publish: Otomat never guesses, and never merges. */
export const PULL_REQUEST_PUBLICATION_MODES = ["draft", "ready"] as const;
export type PullRequestPublicationMode = (typeof PULL_REQUEST_PUBLICATION_MODES)[number];

export const preparePullRequestRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  /** Remote branch the PR ships as; omitted keeps the run branch. Ignored once the PR exists — its head is its identity. */
  head_ref: z.string().trim().min(1).max(120).optional(),
  /** Defaulted so a pre-field cockpit keeps publishing drafts instead of silently opening PRs for review. */
  mode: z.enum(PULL_REQUEST_PUBLICATION_MODES).default("draft"),
});
export type PreparePullRequestRequest = z.infer<typeof preparePullRequestRequestSchema>;

/** AI-drafted metadata for the run's pull request; every field stays editable before publishing. */
export const pullRequestDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  branch: z.string().min(1),
});
export type PullRequestDraft = z.infer<typeof pullRequestDraftSchema>;

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

/** `pull_request` is null while no PR has been prepared; `sync` is null while none is published to compare against. */
export const pullRequestDetailSchema = z.object({
  pull_request: pullRequestContractSchema.nullable(),
  sync: pullRequestSyncSchema.nullable(),
});
export type PullRequestDetail = z.infer<typeof pullRequestDetailSchema>;

export const pushPullRequestRequestSchema = z.object({
  /** The remote head the user was shown, replayed as a lease: absent, the push may only fast-forward. */
  expected_remote_sha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
});
export type PushPullRequestRequest = z.infer<typeof pushPullRequestRequestSchema>;
