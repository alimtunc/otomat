import { z } from "zod";

import { publishPullRequestRequestSchema, pullRequestPublishabilitySchema } from "./detail.js";

export const repositoryPullRequestInputSchema = z.strictObject({
  revision: z.string().min(1),
  base_ref: z.string().trim().min(1).max(120),
});
export type RepositoryPullRequestInput = z.infer<typeof repositoryPullRequestInputSchema>;

export const repositoryPullRequestPreviewSchema = z.object({
  revision: z.string(),
  publishability: pullRequestPublishabilitySchema,
});
export type RepositoryPullRequestPreview = z.infer<typeof repositoryPullRequestPreviewSchema>;

export const publishRepositoryPullRequestSchema = publishPullRequestRequestSchema.extend(
  repositoryPullRequestInputSchema.shape,
);
export type PublishRepositoryPullRequest = z.infer<typeof publishRepositoryPullRequestSchema>;
