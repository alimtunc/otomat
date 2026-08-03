import { z } from "zod";

import { pullRequestContractSchema } from "./entities/pull-request.js";

/** Publish or update the run's GitHub pull request. */
export const preparePullRequestRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  /** Remote branch the PR ships as; omitted keeps the run branch. Ignored once the PR exists — its head is its identity. */
  head_ref: z.string().trim().min(1).max(120).optional(),
});
export type PreparePullRequestRequest = z.infer<typeof preparePullRequestRequestSchema>;

/** AI-drafted metadata for the run's pull request; every field stays editable before publishing. */
export const pullRequestDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  branch: z.string().min(1),
});
export type PullRequestDraft = z.infer<typeof pullRequestDraftSchema>;

/** `pull_request` is null while no PR has been prepared for the run. */
export const pullRequestDetailSchema = z.object({
  pull_request: pullRequestContractSchema.nullable(),
});
export type PullRequestDetail = z.infer<typeof pullRequestDetailSchema>;
