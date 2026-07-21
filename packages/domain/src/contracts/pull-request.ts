import { z } from "zod";

import { pullRequestContractSchema } from "./entities.js";

/** Publish or update the run's GitHub pull request. */
export const preparePullRequestRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
});
export type PreparePullRequestRequest = z.infer<typeof preparePullRequestRequestSchema>;

/** `pull_request` is null while no PR has been prepared for the run. */
export const pullRequestDetailSchema = z.object({
  pull_request: pullRequestContractSchema.nullable(),
});
export type PullRequestDetail = z.infer<typeof pullRequestDetailSchema>;
