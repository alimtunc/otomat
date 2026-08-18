import { z } from "zod";

const SHORT_SHA_LENGTH = 7;

export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

export const runCommitSchema = z.object({
  sha: z.string(),
  short_sha: z.string(),
  subject: z.string(),
  author_name: z.string(),
  // git's `%aI` carries a numeric offset, never `Z`.
  authored_at: z.iso.datetime({ offset: true }),
});
export type RunCommit = z.infer<typeof runCommitSchema>;

/** `unavailable` says why git could not answer, instead of reporting an empty branch. */
export const runCommitsResponseSchema = z.object({
  run_id: z.string(),
  commits: z.array(runCommitSchema),
  unavailable: z.string().nullable(),
});
export type RunCommitsResponse = z.infer<typeof runCommitsResponseSchema>;
