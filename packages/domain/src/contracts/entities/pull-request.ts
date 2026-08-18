import { z } from "zod";

import { PULL_REQUEST_PUBLICATION_STATES, PULL_REQUEST_STATES } from "../entity-states.js";

/** How a publication leaves the pull request on GitHub. Explicit at every publish: Otomat never guesses, and never merges. */
export const PULL_REQUEST_PUBLICATION_MODES = ["draft", "ready"] as const;
export type PullRequestPublicationMode = (typeof PULL_REQUEST_PUBLICATION_MODES)[number];

/** What actually produced a proposal, kept with it so a published PR can say which model wrote its text. */
export const pullRequestGeneratorAuditSchema = z.object({
  runtime: z.string().min(1),
  model: z.string().nullable(),
  effort: z.string().nullable(),
});
export type PullRequestGeneratorAudit = z.infer<typeof pullRequestGeneratorAuditSchema>;

/** Whether Otomat opened the pull request itself or adopted one that already existed on GitHub. */
const PULL_REQUEST_ORIGINS = ["otomat", "imported"] as const;
export const pullRequestOriginSchema = z.enum(PULL_REQUEST_ORIGINS);
export type PullRequestOrigin = z.infer<typeof pullRequestOriginSchema>;

/** Whose branch the pull request ships, decided from evidence alone; an identity that cannot be verified stays `unknown`. */
const PULL_REQUEST_PROVENANCES = ["otomat", "external", "unknown"] as const;
export const pullRequestProvenanceSchema = z.enum(PULL_REQUEST_PROVENANCES);
export type PullRequestProvenance = z.infer<typeof pullRequestProvenanceSchema>;

const PULL_REQUEST_CHECKS_STATES = ["passing", "failing", "pending", "none"] as const;
export const pullRequestChecksStateSchema = z.enum(PULL_REQUEST_CHECKS_STATES);
export type PullRequestChecksState = z.infer<typeof pullRequestChecksStateSchema>;

/** GitHub's own review verdict; null when the pull request requires no review at all. */
const PULL_REQUEST_REVIEW_DECISIONS = ["approved", "changes_requested", "review_required"] as const;
export const pullRequestReviewDecisionSchema = z.enum(PULL_REQUEST_REVIEW_DECISIONS);
export type PullRequestReviewDecision = z.infer<typeof pullRequestReviewDecisionSchema>;

/** Whether the head still merges cleanly; `unknown` is GitHub still computing it, never a guess. */
const PULL_REQUEST_MERGEABILITIES = ["mergeable", "conflicting", "unknown"] as const;
export const pullRequestMergeabilitySchema = z.enum(PULL_REQUEST_MERGEABILITIES);
export type PullRequestMergeability = z.infer<typeof pullRequestMergeabilitySchema>;

export const pullRequestReviewerSchema = z.object({
  kind: z.enum(["user", "team"]),
  /** Login for a user, slug for a team — what the viewer is compared against. */
  handle: z.string().min(1),
});
export type PullRequestReviewer = z.infer<typeof pullRequestReviewerSchema>;

/** How a pull request reached Otomat: typed by the operator, or found from the issue's own identifier. */
const PULL_REQUEST_DISCOVERIES = ["manual", "issue_reference"] as const;
export const pullRequestDiscoverySchema = z.enum(PULL_REQUEST_DISCOVERIES);
export type PullRequestDiscovery = z.infer<typeof pullRequestDiscoverySchema>;

/** What GitHub actually answered when the pull request was verified; every attachment and refresh is justified by one of these. */
export const pullRequestEvidenceSchema = z.object({
  repository: z.string().min(1),
  number: z.number().int().positive(),
  base_ref: z.string().min(1),
  head_ref: z.string().min(1),
  head_sha: z.string().min(1),
  author_login: z.string().nullable(),
  status: z.enum(PULL_REQUEST_STATES),
  discovery: pullRequestDiscoverySchema,
  verified_at: z.iso.datetime(),
});
export type PullRequestEvidence = z.infer<typeof pullRequestEvidenceSchema>;

/** The audit of an adoption: who attached it, when, and on which verified evidence. A detached row never reaches the wire. */
export const pullRequestAttachmentSchema = z.object({
  attached_at: z.iso.datetime(),
  /** GitHub login Otomat was acting as; null when the connection could not name one. */
  attached_by: z.string().nullable(),
  evidence: pullRequestEvidenceSchema,
});
export type PullRequestAttachment = z.infer<typeof pullRequestAttachmentSchema>;

/** Durable mirror of one GitHub pull request and its local publication progress; `run_id` is null for one Otomat adopted rather than opened. */
export const pullRequestContractSchema = z
  .object({
    id: z.string(),
    /** Null for a pull request the inbox synced from GitHub without any issue linking it here. */
    issue_id: z.string().nullable(),
    run_id: z.string().nullable(),
    provider: z.literal("github"),
    origin: pullRequestOriginSchema,
    provenance: pullRequestProvenanceSchema,
    author_login: z.string().nullable(),
    review_decision: pullRequestReviewDecisionSchema.nullable(),
    checks_state: pullRequestChecksStateSchema,
    mergeable: pullRequestMergeabilitySchema,
    requested_reviewers: z.array(pullRequestReviewerSchema),
    /** When GitHub last touched the pull request; null until a sync or a refresh has read one. */
    provider_updated_at: z.iso.datetime().nullable(),
    /** Head commit GitHub reports; what an imported review is pinned to, unlike `published_head_sha`. */
    head_sha: z.string().nullable(),
    attachment: pullRequestAttachmentSchema.nullable(),
    number: z.number().int().positive().nullable(),
    url: z.url().nullable(),
    status: z.enum(PULL_REQUEST_STATES),
    publication_status: z.enum(PULL_REQUEST_PUBLICATION_STATES),
    title: z.string(),
    body: z.string().nullable(),
    head_ref: z.string().nullable(),
    base_ref: z.string().nullable(),
    /** Message of the publication commit the last generation proposed; null until one is generated. */
    commit_subject: z.string().nullable(),
    commit_body: z.string().nullable(),
    generator: pullRequestGeneratorAuditSchema.nullable(),
    /** The commit Otomat last pushed, and the canonical diff it carried; null until one lands. */
    published_head_sha: z.string().nullable(),
    published_diff_sha: z.string().nullable(),
    error_code: z.string().nullable(),
    error_message: z.string().nullable(),
  })
  .superRefine((pullRequest, context) => {
    if (pullRequest.publication_status !== "created") return;
    const confirmedMetadata = [
      pullRequest.number,
      pullRequest.url,
      pullRequest.head_ref,
      pullRequest.base_ref,
    ];
    if (confirmedMetadata.some((value) => value === null)) {
      context.addIssue({
        code: "custom",
        message: "Created pull requests require confirmed provider metadata",
      });
    }
  });
export type PullRequestContract = z.infer<typeof pullRequestContractSchema>;
