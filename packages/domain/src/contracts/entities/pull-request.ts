import { z } from "zod";

import { PULL_REQUEST_PUBLICATION_STATES, PULL_REQUEST_STATES } from "../entity-states.js";

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
    published_head_sha: z.string().nullable(),
    published_diff_sha: z.string().nullable(),
    error_code: z.string().nullable(),
    error_message: z.string().nullable(),
    has_unpublished_changes: z.boolean().nullable(),
  })
  .superRefine((pullRequest, context) => {
    if (pullRequest.publication_status !== "created") return;
    const confirmedMetadata = [
      pullRequest.number,
      pullRequest.url,
      pullRequest.head_ref,
      pullRequest.base_ref,
      pullRequest.published_head_sha,
      pullRequest.published_diff_sha,
    ];
    if (confirmedMetadata.some((value) => value === null)) {
      context.addIssue({
        code: "custom",
        message: "Created pull requests require confirmed provider metadata",
      });
    }
  });
export type PullRequestContract = z.infer<typeof pullRequestContractSchema>;
