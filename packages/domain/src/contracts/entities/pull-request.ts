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
    issue_id: z.string(),
    run_id: z.string().nullable(),
    provider: z.literal("github"),
    origin: pullRequestOriginSchema,
    provenance: pullRequestProvenanceSchema,
    author_login: z.string().nullable(),
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
