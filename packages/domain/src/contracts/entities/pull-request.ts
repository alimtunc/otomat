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

/** Durable mirror of one run's GitHub pull request and its local publication progress. */
export const pullRequestContractSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    provider: z.literal("github"),
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
