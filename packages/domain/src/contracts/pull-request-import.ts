import { z } from "zod";

import {
  pullRequestContractSchema,
  pullRequestEvidenceSchema,
  pullRequestProvenanceSchema,
} from "./entities/pull-request.js";

/** A pull request number (`12`, `#12`) or a GitHub pull-request URL; the daemon verifies whatever it resolves to. */
export const attachPullRequestRequestSchema = z
  .object({ reference: z.string().trim().min(1).max(200) })
  .strict();
export type AttachPullRequestRequest = z.infer<typeof attachPullRequestRequestSchema>;

/** A pull request GitHub links to the issue, verified but not adopted; `reason` is the sentence that explains its provenance. */
export const pullRequestCandidateSchema = z.object({
  evidence: pullRequestEvidenceSchema,
  provenance: pullRequestProvenanceSchema,
  reason: z.string().min(1),
  /** Set when this candidate is already attached, so a surface never offers to adopt it twice. */
  attached_pull_request_id: z.string().nullable(),
});
export type PullRequestCandidate = z.infer<typeof pullRequestCandidateSchema>;

/** Whether detection actually ran, and what it searched or why it could not; absence is stated, never implied by an empty list. */
export const pullRequestDetectionSchema = z.object({
  status: z.enum(["searched", "unavailable"]),
  message: z.string().min(1),
});
export type PullRequestDetection = z.infer<typeof pullRequestDetectionSchema>;

/** Everything an issue can say about its pull requests: the adopted ones, what GitHub links to it, and whether the search happened. */
export const issuePullRequestsSchema = z.object({
  attached: z.array(pullRequestContractSchema),
  candidates: z.array(pullRequestCandidateSchema),
  detection: pullRequestDetectionSchema,
});
export type IssuePullRequests = z.infer<typeof issuePullRequestsSchema>;

/** Refusals an operator must read to act on: each names a verification that failed, never a generic failure. */
const PULL_REQUEST_IMPORT_ERRORS = [
  "pr_reference_invalid",
  "pr_repository_mismatch",
  "pr_not_found",
  "pr_already_attached",
  "pr_not_attached",
  "pr_repository_missing",
  "pr_lookup_failed",
] as const;
export type PullRequestImportErrorCode = (typeof PULL_REQUEST_IMPORT_ERRORS)[number];
export const pullRequestImportErrorSchema = z.object({
  error: z.enum(PULL_REQUEST_IMPORT_ERRORS),
  message: z.string().min(1),
});
export type PullRequestImportError = z.infer<typeof pullRequestImportErrorSchema>;
