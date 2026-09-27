import { z } from "zod";

import { pullRequestContractSchema } from "../entities/pull-request.js";

const pullRequestStackMemberSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  status: pullRequestContractSchema.shape.status,
  head_ref: z.string(),
  base_ref: z.string(),
});
export type PullRequestStackMember = z.infer<typeof pullRequestStackMemberSchema>;

const pullRequestStackSchema = z.object({
  number: z.number().int().positive(),
  base_ref: z.string(),
  members: z.array(pullRequestStackMemberSchema).min(1),
});
export type PullRequestStack = z.infer<typeof pullRequestStackSchema>;

export const pullRequestStackContextSchema = z.object({
  current: pullRequestStackMemberSchema,
  stack: pullRequestStackSchema.nullable(),
  checked_at: z.iso.datetime(),
});
export type PullRequestStackContext = z.infer<typeof pullRequestStackContextSchema>;
